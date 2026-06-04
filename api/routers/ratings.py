from app import app
import psycopg2
from fastapi import Depends, HTTPException, status
from typing import Annotated, Optional
from conn import get_db
from routers.user_token import get_current_user, optional_current_user
from models import *

# Отримати всі відгуки на книгу
@app.get("/api/ratings/{bookId}")
def get_ratings(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[Optional[UserInDB], Depends(optional_current_user)],
  bookId: str) -> list[RatingComment]:
  """
  Отримати список рейтингів та коментарів книги
  """
  userId = currentUser.userId if currentUser else -1

  try:
    cursor = conn.cursor()
    # Вибір порції даних
    sql = f"""SELECT r.rating_id, r.ref_user_id, r.ref_book_id, r.grade, r.review, r.created_at,
        CASE WHEN r.ref_user_id = %s THEN TRUE ELSE FALSE END AS owner, r.is_edit, 
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM ratings r, users u
      WHERE r.ref_user_id = u.user_id
      AND r.ref_book_id = %s
      ORDER BY owner DESC, r.created_at DESC"""

    cursor.execute(sql, (userId, bookId))
    ratings: list[RatingComment] = []
    for (
        ratingId,
        userId,
        bookId,
        grade,
        review,
        createdAt,
        owner,
        isEdit,
        userName) in cursor.fetchall():

      ratings.append(
        RatingComment(
          ratingId=ratingId,
          userId=userId,
          bookId=bookId,
          grade=grade,
          review=review,
          createdAt=createdAt,
          owner=owner,
          isEdit=isEdit,
          userName=userName)
      )
    cursor.close()
    conn.close()

    return ratings
  except psycopg2.Error as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Помилка вибірки даних з БД: " + str(e))
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка вибірки даних: " + str(e))  
  
# Додати відгук
@app.post("/api/ratings")
def create_rating(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[Optional[UserInDB], Depends(get_current_user)],
  rating: Rating):
  """
  Додати рейтинг та коментар до книги
  """

  try:
    cursor = conn.cursor()
    rating.createdAt = datetime.now()
    sql = """INSERT INTO ratings (ref_user_id, ref_book_id, grade, review, created_at)
    VALUES (%s, %s, %s, %s, %s)
    RETURNING rating_id"""
    cursor.execute(
      sql, (currentUser.userId, str(rating.bookId), rating.grade, rating.review, rating.createdAt))
    print(rating.bookId)
    rating.ratingId = cursor.fetchone()[0]
    conn.commit()

    # Отримання загального рейтингу книги (для оновлення інформації по книзі)
    sql = "SELECT AVG(grade) FROM ratings WHERE ref_book_id=%s"
    cursor.execute(sql, (str(rating.bookId),))
    ratingBook = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    return {"rating": rating, "ratingBook": ratingBook}
  except psycopg2.Error as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Помилка додавання відгуку: " + str(e))
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка додавання відгуку: " + str(e))      

# Редагувати відгук
@app.put("/api/ratings")
def update_rating(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[UserInDB, Depends(get_current_user)],
  rating: Rating):
  """
  Редагувати рейтинг та коментар
  """

  try:
    cursor = conn.cursor()
    cursor.execute(
        """SELECT ref_user_id
        FROM ratings
        WHERE rating_id = %s""",
        (rating.ratingId,))
    result = cursor.fetchone()

    if not result:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Відгук не знайдено")

    sql = """UPDATE ratings
    SET grade = %s, review = %s, is_edit = TRUE
    WHERE rating_id = %s"""
    cursor.execute(sql, (rating.grade, rating.review, rating.ratingId))
    conn.commit()
    rating.isEdit = True

    # Отримання загального рейтингу книги (для оновлення інформації по книзі)
    sql = "SELECT AVG(grade) FROM ratings WHERE ref_book_id=%s"
    cursor.execute(sql, (str(rating.bookId),))
    ratingBook = cursor.fetchone()[0]
    
    cursor.close()
    conn.close()
    return { "rating": rating, "ratingBook": ratingBook }

  except psycopg2.Error as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Помилка редагування відгуку: " + str(e))
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка редагування відгуку: " + str(e))  

# Видалити відгук
@app.delete("/api/ratings/{ratingId}/{bookId}")
def delete_rating(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[UserInDB, Depends(get_current_user)],
  ratingId: int,
  bookId: str):
  """
  Видалити рейтинг та коментар
  """
  try:
    cursor = conn.cursor()
    cursor.execute(
        """SELECT ref_user_id
        FROM ratings
        WHERE rating_id = %s""",
        (ratingId,))
    result = cursor.fetchone()

    if not result:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Відгук не знайдено")

    cursor.execute(
        """DELETE FROM ratings
        WHERE rating_id = %s""",
        (ratingId,))
    conn.commit()

    # Отримання загального рейтингу книги (для оновлення інформації по книзі)
    sql = "SELECT COALESCE(AVG(grade), 0) FROM ratings WHERE ref_book_id=%s"
    cursor.execute(sql, (bookId,))
    ratingBook = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    return { "ratingBook": ratingBook }
  except psycopg2.Error as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Помилка видалення відгуку з БД: " + str(e))
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка видалення відгуку: " + str(e))      