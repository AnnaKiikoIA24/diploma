from app import app
import psycopg2 
from fastapi import Depends, HTTPException, status
from typing import Annotated
from conn import get_db
from routers.user_token import get_current_user
from models import *

@app.get("/api/statistic")
def get_books(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[UserInDB, Depends(get_current_user)]):
  """
  Аналітична інформація для адміністратора
  """    
  print("Get Statistic: ")

  # Доступ до статистики доступний лише для користувача з правами адміністратора
  if currentUser.role == False:
    raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, 
                        detail="Доступ до статистики доступний лише для користувача з правами адміністратора")

  try:
    cursor = conn.cursor()

      # Загальна кількість книг 
    sql = "SELECT COUNT(*) FROM books"
    cursor.execute(sql)
    totalBooks, = cursor.fetchone()  

    # Загальна кількість користувачів 
    sql = "SELECT COUNT(*) FROM users"
    cursor.execute(sql)
    totalUsers, = cursor.fetchone()   

    # Кількість активних користувачів за останній місяць
    sql = """SELECT COUNT(distinct ref_user_id) FROM reading
            WHERE CURRENT_DATE - INTERVAL '1 month' <= COALESCE(finished_at, DATE '3001-01-01')
            AND CURRENT_TIMESTAMP >= created_at"""
    cursor.execute(sql)
    activeUsers, = cursor.fetchone()   

    # Топ-5 книг за кількістю читачів
    sql = """SELECT b.book_id, b.book_name, 
            string_agg(DISTINCT concat(a.author_firstname, ' ', a.author_lastname), ', ') as authors,
            COUNT(DISTINCT r.ref_user_id) FILTER (WHERE r.finished_at IS NULL) as cnt_unfinished,
            COUNT(DISTINCT r.ref_user_id) FILTER (WHERE r.finished_at IS NOT NULL) as cnt_finished 
          FROM reading r, books b, link_authors_books l_a, authors a
          WHERE b.book_id = r.ref_book_id
          and b.book_id = l_a.ref_book_id
          and l_a.ref_author_id = a.author_id
          GROUP BY b.book_id, b.book_name
          ORDER BY COUNT(distinct r.ref_user_id) DESC
          LIMIT 5"""
    cursor.execute(sql)

    topBooks = []
    for bookId, bookName, authors, cntUnfinished, cntFinished in cursor.fetchall():
      topBooks.append({
        "bookId": bookId,
        "bookName": bookName,
        "authors": authors,
        "cntUnfinished": cntUnfinished,
        "cntFinished": cntFinished
      }) 

    # Топ-5 авторів за кількістю їхніх прочитаних книг
    sql = """SELECT a.author_id, concat(a.author_firstname, ' ', a.author_lastname) as author_info,
          COUNT(DISTINCT b.book_id) as cnt_books,
          COALESCE(COUNT(DISTINCT r.ref_user_id || '-' || r.ref_book_id) FILTER (WHERE r.finished_at IS NULL), 0) as cnt_unfinished,
          COALESCE(COUNT(DISTINCT r.ref_user_id || '-' || r.ref_book_id) FILTER (WHERE r.finished_at IS NOT NULL), 0) as cnt_finished
        FROM books b
        INNER JOIN link_authors_books l_a ON b.book_id = l_a.ref_book_id
        INNER JOIN authors a ON l_a.ref_author_id = a.author_id
        LEFT OUTER JOIN reading r ON b.book_id = r.ref_book_id 
        GROUP BY a.author_id, a.author_firstname, a.author_lastname
        ORDER BY 3 DESC
        LIMIT 5"""
    cursor.execute(sql)

    topAuthors = []
    for authorId, authorInfo, cntBooks, cntUnfinished, cntFinished in cursor.fetchall():
      topAuthors.append({
        "authorId": authorId,
        "authorInfo": authorInfo,
        "cntBooks": cntBooks,
        "cntUnfinished": cntUnfinished,
        "cntFinished": cntFinished
      }) 

    # Топ-5 користувачів за кількістю прочитаних книг
    sql = """SELECT u.user_id, concat(u.first_name, ' ', u.last_name, ' (', u.login, ')') as user_info,
            COUNT(*) FILTER (WHERE r.finished_at IS NULL) as cnt_unfinished, 
            COUNT(*) FILTER (WHERE r.finished_at IS NOT NULL) as cnt_finished 
          FROM reading r, users u
          WHERE u.user_id = r.ref_user_id
          GROUP BY u.user_id, u.first_name, u.last_name, u.login
          ORDER BY COUNT(*) DESC
          LIMIT 5"""
    cursor.execute(sql)

    topUsers = []
    for userId, userInfo, cntUnfinished, cntFinished in cursor.fetchall():
      topUsers.append({
        "userId": userId,
        "userInfo": userInfo,
        "cntUnfinished": cntUnfinished,
        "cntFinished": cntFinished
      }) 

    # Кількість екземплярів книг за останні півроку, які було розпочато читати або завершено 
    sql = """SET lc_time = 'uk_UA.UTF-8';
            WITH months AS (
                SELECT generate_series(
                    date_trunc('month', CURRENT_DATE) - interval '6 months',
                    date_trunc('month', CURRENT_DATE) - interval '1 months',
                    interval '1 month'
                )::date AS month_data
            ),
            data_started AS (
                SELECT date_trunc('MONTH', created_at) as month_start, count(*) as cnt_reading
              FROM reading
              WHERE created_at BETWEEN (date_trunc('MONTH', CURRENT_DATE) - INTERVAL '6 month') and date_trunc('MONTH', CURRENT_DATE)
              GROUP BY date_trunc('MONTH', created_at)
            ),
            data_finished AS (
                SELECT date_trunc('MONTH', finished_at) as month_fin, count(*) as cnt_reading
              FROM reading
              WHERE finished_at BETWEEN (date_trunc('MONTH', CURRENT_DATE) - INTERVAL '6 month') and date_trunc('MONTH', CURRENT_DATE)
              GROUP BY date_trunc('MONTH', finished_at)
            )
            SELECT TO_CHAR(months.month_data, 'TMMonth') as month_data, 
              COALESCE(data_started.cnt_reading, 0) as cnt_started, 
              COALESCE(data_finished.cnt_reading, 0) as cnt_finished
            FROM months
            LEFT OUTER JOIN data_started
            ON months.month_data = data_started.month_start
            LEFT OUTER JOIN data_finished
            ON months.month_data = data_finished.month_fin
            ORDER BY months.month_data"""
    cursor.execute(sql)

    readActivity = []
    for month, cntStarted, cntFinished in cursor.fetchall():
      readActivity.append({
        "month": month,
        "cntStarted": cntStarted,
        "cntFinished": cntFinished
      }) 

    # Розподіл книг за жанрами
    sql = """SELECT g.genre_id, g.genre_name, g.chart_color, count(*) as cnt_books
          FROM genres g, link_genres_books l_g 
          WHERE l_g.ref_genre_id = g.genre_id
          GROUP BY  g.genre_id, g.genre_name, g.chart_color
          ORDER BY g.genre_name"""
    cursor.execute(sql)

    booksByGenre = []
    for genreId, genreName, chartColor, cntBooks in cursor.fetchall():
      booksByGenre.append({
        "genreId": genreId,
        "genreName": genreName,
        "chartColor": chartColor,
        "cntBooks": cntBooks
      }) 
    cursor.close()
    conn.close()

    return {
      "totalBooks": totalBooks,
      "totalUsers": totalUsers,
      "activeUsers": activeUsers,
      "topBooks": topBooks,
      "topAuthors": topAuthors,
      "topUsers": topUsers,
      "readActivity": readActivity,
      "booksByGenre": booksByGenre
    }
  
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки статистичних даних з БД: " + str(e))
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка вибірки статистичних  даних: " + str(e))    

