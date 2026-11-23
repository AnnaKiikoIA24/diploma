from datetime import datetime, timedelta, timezone
from io import BytesIO
from unittest.mock import MagicMock
import os
import sys
import uuid

import jwt
import numpy as np
import pytest
import requests
from fastapi.testclient import TestClient
from meilisearch.errors import MeilisearchApiError

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-jwt-signing-12345")
os.environ.setdefault("REFRESH_KEY", "test-refresh-key-for-jwt-signing-67890")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("MEILISEARCH_URL", "http://localhost:7700")
os.environ.setdefault("MEILISEARCH_MASTER_KEY", "MASTER_KEY")

from conn import get_db  # noqa: E402
from main import app  # noqa: E402
from models import UserInDB  # noqa: E402
from routers.recommended import art1_clustering, make_recommendation  # noqa: E402
from routers.user_token import (  # noqa: E402
    generate_jwt_token,
    get_current_user,
    get_password_hash,
    optional_current_user,
)

client = TestClient(app)

BOOK_UUID_1 = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
BOOK_UUID_2 = "a1b2c3d4-1111-4222-8333-444455556666"


def make_user(*, user_id: int = 1, role: bool = False, username: str = "reader1") -> UserInDB:
    return UserInDB(
        userId=user_id,
        username=username,
        firstName="Олена",
        lastName="Коваленко",
        role=role,
        externalAccount=False,
        favoritesCnt=2,
        hashedPassword="hashed-password",
    )


def make_mock_db(fetchone_seq=None, fetchall_seq=None):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    if fetchone_seq is not None:
        cursor.fetchone.side_effect = list(fetchone_seq)
    if fetchall_seq is not None:
        cursor.fetchall.side_effect = list(fetchall_seq)
    return conn, cursor


def make_book_card_row(book_id: str = BOOK_UUID_1, title: str = "Кобзар"):
    return (
        book_id,
        title,
        9789660000011,
        1840,
        b"fake-cover-bytes",
        "data:image/jpeg;base64",
        1,
        4.8,
        "10,11",
        "5",
        "Поетична збірка",
        "поезія, класика",
        "kobzar.pdf",
        True,
        datetime(2026, 1, 10, 12, 0, 0),
        None,
    )


@pytest.fixture(autouse=True)
def reset_dependency_overrides():
    yield
    app.dependency_overrides.clear()
    client.cookies.clear()


# TC-01: Успішна локальна аутентифікація користувача
def test_login_local_user_success():
    password_hash = get_password_hash("secret123")
    conn, _ = make_mock_db(
        fetchone_seq=[(1, password_hash, "Олена", "Коваленко", False, False, 2)]
    )
    app.dependency_overrides[get_db] = lambda: conn

    response = client.post(
        "/api/auth/login",
        data={"username": "reader1", "password": "secret123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["username"] == "reader1"
    assert body["token"]["token_type"] == "bearer"
    assert len(body["token"]["access_token"]) > 20
    assert "refresh_token" in response.cookies


# TC-02 (BUG-03): Прострочений або відсутній JWT має повертати 401 Unauthorized
def test_expired_jwt_returns_401():
    conn, _ = make_mock_db()
    app.dependency_overrides[get_db] = lambda: conn

    expired_token = generate_jwt_token(
        data={"sub": "reader1"},
        key=os.environ["SECRET_KEY"],
        expiresDelta=timedelta(minutes=-5),
    )

    response_expired = client.get(
        "/api/users/me/",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response_expired.status_code == 401
    assert response_expired.json()["detail"] == "Token has expired"
    assert response_expired.headers.get("www-authenticate") == "Bearer"

    response_missing = client.get("/api/users/me/")
    assert response_missing.status_code == 401

    response_invalid = client.get(
        "/api/users/me/",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert response_invalid.status_code == 401


# TC-17: Реєстрація користувача, перевірка дубліката (409) та оновлення токена
def test_register_user_conflict_and_refresh():
    conn_create, _ = make_mock_db(fetchone_seq=[None, (15,)])
    app.dependency_overrides[get_db] = lambda: conn_create

    payload = {
        "username": "new_reader",
        "password": "password123",
        "lastName": "Петренко",
        "firstName": "Іван",
        "role": False,
    }
    resp_ok = client.post("/api/users", json=payload)
    assert resp_ok.status_code == 200
    assert resp_ok.json()["user"]["userId"] == 15
    assert "access_token" in resp_ok.json()["token"]

    conn_dup, _ = make_mock_db(fetchone_seq=[(15,)])
    app.dependency_overrides[get_db] = lambda: conn_dup
    resp_conflict = client.post("/api/users", json=payload)
    assert resp_conflict.status_code == 409

    refresh_token = jwt.encode(
        {"sub": "new_reader", "exp": datetime.now(timezone.utc) + timedelta(days=1)},
        os.environ["REFRESH_KEY"],
        algorithm=os.environ["ALGORITHM"],
    )
    client.cookies.set("refresh_token", refresh_token)
    resp_refresh = client.post("/api/auth/refresh")
    assert resp_refresh.status_code == 200
    assert resp_refresh.json()["token_type"] == "bearer"


# TC-03: Отримання довідників мов, авторів і жанрів
def test_get_catalogs_structure():
    conn, _ = make_mock_db(
        fetchall_seq=[
            [(1, "Українська", "uk"), (2, "Англійська", "en")],
            [(10, "Тарас", "Шевченко"), (11, "Іван", "Франко")],
            [(5, "Класика"), (6, "Поезія")],
        ]
    )
    app.dependency_overrides[get_db] = lambda: conn

    response = client.get("/api/catalogs")
    assert response.status_code == 200
    data = response.json()
    assert len(data["languages"]) == 2
    assert data["authors"][0]["name"] == "Тарас Шевченко"
    assert data["genres"][1]["name"] == "Поезія"


# TC-11: Пагінація каталогу книг та кодування обкладинки в Base64
def test_get_books_pagination_and_cover():
    conn, _ = make_mock_db(
        fetchone_seq=[(2,), (10,)],
        fetchall_seq=[[make_book_card_row()]],
    )
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[optional_current_user] = lambda: make_user(user_id=1)

    response = client.get("/api/books?offset=0&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["totalRecords"] == 10
    assert data["totalUserRecords"] == 2
    assert len(data["items"]) == 1
    assert data["items"][0]["bookCover"].startswith("data:image/jpeg;base64,")
    assert data["items"][0]["authors"] == [10, 11]


# TC-12: Отримання книги за ID та повернення 404 для відсутньої книги
def test_get_book_by_id_and_not_found():
    row = (
        BOOK_UUID_1,
        "Кобзар",
        9789660000011,
        1840,
        None,
        None,
        1,
        "10",
        "5",
        "Анотація",
        "поезія",
        "kobzar.pdf",
    )
    conn_found, _ = make_mock_db(fetchone_seq=[row])
    app.dependency_overrides[get_db] = lambda: conn_found

    resp_ok = client.get(f"/api/books/{BOOK_UUID_1}")
    assert resp_ok.status_code == 200
    assert resp_ok.json()["bookName"] == "Кобзар"

    conn_missing, _ = make_mock_db(fetchone_seq=[None])
    app.dependency_overrides[get_db] = lambda: conn_missing

    resp_404 = client.get(f"/api/books/{uuid.uuid4()}")
    assert resp_404.status_code == 404


# TC-13: Створення та оновлення книги адміністратором
def test_create_and_update_book_admin():
    conn, _ = make_mock_db(fetchone_seq=[("1,2", "3")])
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1, role=True)

    new_book = {
        "bookName": "Лісова пісня",
        "bookCover": "data:image/png;base64,AQID",
        "isbn": 9789660000022,
        "languageId": 1,
        "authors": [1, 2],
        "bookYear": 1911,
        "genres": [3],
        "annotation": "Драма-феєрія",
        "keyWords": "драма, класика",
        "source": None,
    }
    resp_create = client.post("/api/books", json=new_book)
    assert resp_create.status_code == 200
    created = resp_create.json()
    assert created["bookId"] is not None

    updated_book = {**created, "authors": [2, 4], "genres": [3, 5]}
    resp_update = client.put("/api/books", json=updated_book)
    assert resp_update.status_code == 200
    assert resp_update.json()["authors"] == [2, 4]
    assert conn.commit.call_count == 2


# TC-14: Видалення книги з перевіркою прав доступу (RBAC)
def test_delete_book_rbac_and_success():
    conn, _ = make_mock_db(fetchone_seq=[(BOOK_UUID_1,), None])
    app.dependency_overrides[get_db] = lambda: conn

    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=2, role=False)
    resp_forbidden = client.delete(f"/api/books/{BOOK_UUID_1}")
    assert resp_forbidden.status_code == 403

    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1, role=True)
    resp_ok = client.delete(f"/api/books/{BOOK_UUID_1}")
    assert resp_ok.status_code == 200

    resp_not_found = client.delete(f"/api/books/{uuid.uuid4()}")
    assert resp_not_found.status_code == 404


# TC-04: Багатокритеріальна фільтрація книг за роком, жанром і рейтингом
def test_filter_books_by_year_and_rating():
    conn, _ = make_mock_db(
        fetchone_seq=[(1,), (1,)],
        fetchall_seq=[[make_book_card_row()]],
    )
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[optional_current_user] = lambda: make_user(user_id=1)

    filters_payload = {
        "bookName": "Кобзар",
        "minYear": 1800,
        "maxYear": 2025,
        "languages": [1],
        "authors": [10],
        "genres": [5],
        "rating": 4,
        "isRead": 2,
    }
    response = client.post("/api/filters/books?offset=0&limit=20", json=filters_payload)
    assert response.status_code == 200
    body = response.json()
    assert body["totalRecords"] == 1
    assert body["items"][0]["bookName"] == "Кобзар"


# TC-05: Успішний повнотекстовий пошук книг у Meilisearch
def test_meilisearch_valid_query(monkeypatch):
    mock_index = MagicMock()
    mock_index.search.return_value = {
        "hits": [{"id": BOOK_UUID_1, "book_name": "Кобзар", "authors": "Шевченко"}]
    }
    mock_client = MagicMock()
    mock_client.index.return_value = mock_index
    monkeypatch.setattr("routers.books.Client", lambda url, key: mock_client)

    response = client.get("/api/meilisearch/search", params={"searchStr": "Кобзар"})
    assert response.status_code == 200
    assert len(response.json()) == 1
    mock_index.search.assert_called_once()


# TC-06 (BUG-01): Санітизація порожніх запитів та запитів зі спецсимволами в Meilisearch
def test_meilisearch_special_chars_and_empty(monkeypatch):
    mock_index = MagicMock()
    mock_index.search.return_value = {
        "hits": [{"id": BOOK_UUID_2, "book_name": "Дари волхвів", "authors": "О’Генрі"}]
    }
    mock_client = MagicMock()
    mock_client.index.return_value = mock_index
    monkeypatch.setattr("routers.books.Client", lambda url, key: mock_client)

    resp_empty = client.get("/api/meilisearch/search", params={"searchStr": "   "})
    assert resp_empty.status_code == 200
    assert resp_empty.json() == []
    mock_index.search.assert_not_called()

    resp_special = client.get(
        "/api/meilisearch/search",
        params={"searchStr": '   "О\'Генрі\x00; --\\'},
    )
    assert resp_special.status_code == 200
    called_query = mock_index.search.call_args[0][0]
    assert '"' not in called_query
    assert ";" not in called_query
    assert "\x00" not in called_query
    assert "О’Генрі" in called_query

    fake_resp = requests.Response()
    fake_resp.status_code = 400
    fake_resp._content = (
        b'{"message": "Invalid search query", "code": "invalid_search_q", '
        b'"type": "invalid_request", "link": "https://docs.meilisearch.com/errors"}'
    )
    mock_index.search.side_effect = MeilisearchApiError("Invalid search query", fake_resp)

    resp_bad = client.get("/api/meilisearch/search", params={"searchStr": "test"})
    assert resp_bad.status_code == 400


# TC-07: Тестування алгоритму кластеризації ART1 та ендпоінта рекомендацій
def test_art1_clustering_recommendations():
    matrix = np.array(
        [
            [1, 0, 0],
            [1, 1, 0],
            [0, 0, 1],
            [0, 0, 0],
        ]
    )
    clusters = art1_clustering(matrix, rho=0.5)
    assert len(clusters) == 3

    book_ids = [BOOK_UUID_1, BOOK_UUID_2, str(uuid.uuid4())]
    recs = make_recommendation(clusters, matrix[0], book_ids)
    assert recs == [BOOK_UUID_2]

    reading_matrix_rows = [
        (1, BOOK_UUID_1, 1),
        (1, BOOK_UUID_2, 0),
        (2, BOOK_UUID_1, 1),
        (2, BOOK_UUID_2, 1),
    ]
    conn, _ = make_mock_db(
        fetchall_seq=[
            reading_matrix_rows,
            [make_book_card_row(book_id=BOOK_UUID_2, title="Дари волхвів")],
        ]
    )
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1)

    response = client.get("/api/recommended")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["bookId"] == BOOK_UUID_2


# TC-16: Рекомендації схожих книг на основі жанрів та історії читання
def test_recommended_by_book_genres():
    conn, _ = make_mock_db(
        fetchall_seq=[[make_book_card_row(book_id=BOOK_UUID_2, title="Тигролови")]]
    )
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1)

    response = client.get(f"/api/recommended/{BOOK_UUID_1}")
    assert response.status_code == 200
    assert response.json()[0]["bookName"] == "Тигролови"


# TC-08 (BUG-02): Захист від ZeroDivisionError при оновленні прогресу читання
def test_reading_progress_zero_total_pages():
    conn, _ = make_mock_db()
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1)

    resp_zero = client.put(
        f"/api/reading/{BOOK_UUID_1}/progress",
        json={"current_page": 1, "total_pages": 0},
    )
    assert resp_zero.status_code == 200
    assert resp_zero.json()["progressPercent"] == 0.0

    resp_none = client.put(
        f"/api/reading/{BOOK_UUID_1}/progress",
        json={"current_page": 5, "total_pages": None},
    )
    assert resp_none.status_code == 200
    assert resp_none.json()["totalPages"] == 0
    assert resp_none.json()["progressPercent"] == 0.0

    resp_valid = client.put(
        f"/api/reading/{BOOK_UUID_1}/progress",
        json={"current_page": 45, "total_pages": 180},
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["progressPercent"] == 25.0

    resp_clamped = client.put(
        f"/api/reading/{BOOK_UUID_1}/progress",
        json={"current_page": 300, "total_pages": 180},
    )
    assert resp_clamped.status_code == 200
    assert resp_clamped.json()["currentPage"] == 180
    assert resp_clamped.json()["progressPercent"] == 100.0


# TC-19: Фіксація початку/завершення читання та видалення з обраного
def test_mark_read_unread_and_delete_favorite():
    conn, _ = make_mock_db(fetchone_seq=[None, (1,), None, (1,)])
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1)

    resp_start = client.post(f"/api/reading/start/{BOOK_UUID_1}")
    assert resp_start.status_code == 200
    assert resp_start.json() is not None

    resp_finish = client.post(f"/api/reading/{BOOK_UUID_1}/1")
    assert resp_finish.status_code == 200
    assert resp_finish.json() is not None

    resp_conflict = client.post(f"/api/reading/{BOOK_UUID_1}/1")
    assert resp_conflict.status_code == 409

    resp_del_fav = client.delete(f"/api/favorites/{BOOK_UUID_1}")
    assert resp_del_fav.status_code == 200
    assert resp_del_fav.json() is True


# TC-09: Додавання книги до обраного та створення відгуку з перерахунком рейтингу
def test_add_favorite_and_create_rating():
    conn, _ = make_mock_db(fetchone_seq=[None, (1,), (42,), (4.5,)])
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1)

    resp_fav = client.post(f"/api/favorites/{BOOK_UUID_1}")
    assert resp_fav.status_code == 200
    assert resp_fav.json() is True

    resp_fav_dup = client.post(f"/api/favorites/{BOOK_UUID_1}")
    assert resp_fav_dup.status_code == 409

    rating_payload = {
        "userId": 1,
        "bookId": BOOK_UUID_1,
        "grade": 5,
        "review": "Чудова класика!",
    }
    resp_rating = client.post("/api/ratings", json=rating_payload)
    assert resp_rating.status_code == 200
    assert resp_rating.json()["rating"]["ratingId"] == 42
    assert resp_rating.json()["ratingBook"] == 4.5


# TC-18: Перегляд, редагування та видалення відгуку з оновленням середньої оцінки
def test_ratings_crud_and_avg_recalculation():
    conn, _ = make_mock_db(
        fetchone_seq=[(1,), (4.75,), (1,), (4.0,), None],
        fetchall_seq=[
            [
                (
                    42,
                    1,
                    BOOK_UUID_1,
                    5,
                    "Чудово",
                    datetime(2026, 1, 2, 10, 0, 0),
                    True,
                    False,
                    "Олена Коваленко",
                )
            ]
        ],
    )
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[optional_current_user] = lambda: make_user(user_id=1)
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1)

    resp_list = client.get(f"/api/ratings/{BOOK_UUID_1}")
    assert resp_list.status_code == 200
    assert resp_list.json()[0]["owner"] is True

    resp_edit = client.put(
        "/api/ratings",
        json={
            "ratingId": 42,
            "userId": 1,
            "bookId": BOOK_UUID_1,
            "grade": 4,
            "review": "Оновлений відгук",
        },
    )
    assert resp_edit.status_code == 200
    assert resp_edit.json()["rating"]["isEdit"] is True
    assert resp_edit.json()["ratingBook"] == 4.75

    resp_delete = client.delete(f"/api/ratings/42/{BOOK_UUID_1}")
    assert resp_delete.status_code == 200
    assert resp_delete.json()["ratingBook"] == 4.0

    resp_missing = client.delete(f"/api/ratings/999/{BOOK_UUID_1}")
    assert resp_missing.status_code == 404


# TC-20: Валідація завантаження та видачі контенту книги (.pdf / .txt)
def test_content_upload_extension_validation(tmp_path, monkeypatch):
    monkeypatch.setenv("folderSource", str(tmp_path))
    conn, _ = make_mock_db()
    app.dependency_overrides[get_db] = lambda: conn

    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=2, role=False)
    resp_forbidden = client.post(
        f"/api/content?bookId={BOOK_UUID_1}",
        files={"file": ("book.pdf", BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert resp_forbidden.status_code == 403

    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1, role=True)
    resp_invalid_ext = client.post(
        f"/api/content?bookId={BOOK_UUID_1}",
        files={"file": ("malware.txt", BytesIO(b"plain text"), "text/plain")},
    )
    assert resp_invalid_ext.status_code == 400

    resp_valid_pdf = client.post(
        f"/api/content?bookId={BOOK_UUID_1}",
        files={"file": ("book.pdf", BytesIO(b"%PDF-1.4 sample"), "application/pdf")},
    )
    assert resp_valid_pdf.status_code == 200
    saved_name = resp_valid_pdf.json()
    assert saved_name == f"{BOOK_UUID_1}.pdf"
    assert (tmp_path / saved_name).exists()

    resp_read = client.get("/api/reading", params={"fileName": saved_name})
    assert resp_read.status_code == 200
    assert resp_read.headers["content-type"] == "application/pdf"

    resp_missing = client.get("/api/reading", params={"fileName": "missing.pdf"})
    assert resp_missing.status_code == 404


# TC-10: Заборона доступу до аналітики для звичайного користувача
def test_statistic_forbidden_for_regular_user():
    conn, _ = make_mock_db()
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=2, role=False)

    response = client.get("/api/statistic")
    assert response.status_code == 403


# TC-15: Формування повного аналітичного звіту адміністратором
def test_statistic_admin_full_report():
    conn, _ = make_mock_db(
        fetchone_seq=[(120,), (45,), (18,)],
        fetchall_seq=[
            [(BOOK_UUID_1, "Кобзар", "Тарас Шевченко", 3, 12)],
            [(10, "Тарас Шевченко", 5, 3, 12)],
            [(1, "Олена Коваленко (reader1)", 1, 7)],
            [("Січень", 14, 9)],
            [(5, "Класика", "#FFAA00", 34)],
        ],
    )
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: make_user(user_id=1, role=True)

    response = client.get("/api/statistic")
    assert response.status_code == 200
    report = response.json()
    assert report["totalBooks"] == 120
    assert report["totalUsers"] == 45
    assert report["activeUsers"] == 18
    assert report["topBooks"][0]["bookName"] == "Кобзар"
    assert report["topAuthors"][0]["authorInfo"] == "Тарас Шевченко"
    assert report["topUsers"][0]["cntFinished"] == 7
    assert report["readActivity"][0]["month"] == "Січень"
    assert report["booksByGenre"][0]["genreName"] == "Класика"
