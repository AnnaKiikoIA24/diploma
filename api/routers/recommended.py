from app import app
import psycopg2 
from fastapi import Depends, HTTPException, status
from typing import Annotated
from conn import get_db
from routers.user_token import get_current_user
from models import *
import base64
import numpy as np

# -----------------------------------------
# Рекомендації по заданій книзі
@app.get("/api/recommended/{bookId}")
def get_recommended_by_book(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[UserInDB, Depends(get_current_user)],
  bookId: str) -> list[BookCard]:
  """
  Перелік рекомендованих книг на основі заданої книги
  """    
  print("Get Recommended: bookId=", bookId)

  userId: int = currentUser.userId
  print("userId=", userId)

  try:
    cursor = conn.cursor()

    # Вибір рекомендованих книг
    sql = f"""-- Книги тих самих жанрів, що і задана
      WITH genres_book AS (
      SELECT g_b.ref_book_id, COALESCE(AVG(r.grade),0) as grade
      FROM link_genres_books g_b
      LEFT OUTER JOIN ratings r ON r.ref_book_id = g_b.ref_book_id
      WHERE g_b.ref_genre_id IN (
        -- Жанри заданої книги
        SELECT ref_genre_id
        FROM link_genres_books 
        WHERE ref_book_id = %s)
      AND g_b.ref_book_id <> %s
      GROUP BY g_b.ref_book_id),

      -- Інші користувачі, що читали задану книгу
      users_book AS (
        SELECT ref_user_id FROM reading r 
        WHERE ref_book_id=%s
        AND ref_user_id <> %s),
      -- Інші книги, які читали користувачі, що читали задану книгу
      readed AS (
        SELECT r.ref_book_id, AVG(COALESCE(rat.grade,0)) as grade 
        FROM reading r
        INNER JOIN users_book u_b ON r.ref_user_id = u_b.ref_user_id
        LEFT OUTER JOIN ratings rat ON rat.ref_book_id=r.ref_book_id 
        WHERE r.ref_book_id <> %s
        GROUP BY r.ref_book_id
      ),

      -- 4 рекомендовані книги (їхні ідентифікатори та рейтинг)
      recommended AS (
        -- Обираємо книги тих самих жанрів; доєднуємо з прочитаними користувачами, що читали задану книгу
        SELECT genres_book.ref_book_id,
          COALESCE(genres_book.ref_book_id = readed.ref_book_id, False) as Is_Equal,
          True as Is_Equal_Genre,
          COALESCE(genres_book.grade,0) AS GRADE
        FROM genres_book
        LEFT OUTER JOIN readed ON genres_book.ref_book_id = readed.ref_book_id
      	-- Обираємо прочитані користувачами (тими, що читали задану книгу), доєднуємо книги тих самих жанрів
        UNION 
        SELECT readed.ref_book_id, 
          COALESCE(genres_book.ref_book_id = readed.ref_book_id, False) as Is_Equal,
          False as Is_Equal_Genre,
          readed.grade
        FROM genres_book 
        RIGHT OUTER JOIN readed ON genres_book.ref_book_id = readed.ref_book_id

        -- Першими виводимо книги, у яких співпадають жанри із заданою і які читали ті самі користувачі 
        -- Якщо таких не знайдено, то ті у яких співпадають жанри, останніми, що читали інші користувачі, що читали задану книгу
        -- Останній критерій сортування - рейтинг книги
        ORDER BY Is_Equal DESC, Is_Equal_Genre DESC, grade DESC 
        LIMIT 4)

      -- Фінальний запит з переліку рекомендованих книг: доєднуємо атрибути для відображення        
      SELECT b.book_id, b.book_name, b."ISBN", b.book_year, b.book_cover, book_cover_mime, 
            b.ref_language_id, recomm.grade AS rating,
            (select string_agg(CAST(ref_author_id AS text), ',') from link_authors_books a where b.book_id=a.ref_book_id) as authors,
            (select string_agg(CAST(ref_genre_id AS text), ',') from link_genres_books g where b.book_id=g.ref_book_id) as genres,
            b.annotation, b.key_words, 
            (select source_link from sources s where b.book_id = s.ref_book_id limit 1) as source,
            COALESCE((select True from link_users_books u_b where u_b.ref_user_id = %s and u_b.ref_book_id=b.book_id), False) is_favorite,
            reading.created_at as start_reading, reading.finished_at as finish_reading	   
      FROM books b
      INNER JOIN recommended recomm ON b.book_id = recomm.ref_book_id 
      LEFT OUTER JOIN reading ON reading.ref_user_id = %s AND reading.ref_book_id=b.book_id 
      GROUP BY b.book_id, b.book_name, b."ISBN", b.book_year, b.ref_language_id, b.book_cover, book_cover_mime, 
        b.annotation, b.key_words, recomm.grade, 
        reading.created_at, reading.finished_at """

    cursor.execute(sql, (bookId, bookId, bookId, userId, bookId, userId, userId))

    books: list[BookCard] = []
    for bookId, bookName, isbn, bookYear, bookCoverBytes, bookCoverMime, languageId, rating, authors, genres, annotation, keyWords, source, isFavorite, dateStartRead, dateFinishRead  in cursor.fetchall():
      listAuthors = [int(authorId) for authorId in authors.split(",")]
      listGenres = [int(genreId) for genreId in genres.split(",")]
      # перетворюємо масив байтів в base64 строку
      bookCoverBase64: str = None
      if bookCoverBytes != None:
        bookCoverBase64 = bookCoverMime + "," + base64.b64encode(bookCoverBytes).decode('utf-8')

      books.append(
        BookCard(bookId=bookId,
                isbn=isbn,
                bookName=bookName,
                bookYear=bookYear,
                bookCover=bookCoverBase64,
                languageId=languageId,
                authors=listAuthors,
                genres=listGenres,
                rating=rating,
                annotation=annotation,
                keyWords=keyWords,
                source=source,
                isFavorite=isFavorite,
                dateStartRead=dateStartRead,
                dateFinishRead=dateFinishRead
        )) 
    cursor.close()
    conn.close()

    return books
  
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки рекомендованих книг даних з БД: " + str(e))

# -----------------------------------------
# Загальні рекомендації для користувача
@app.get("/api/recommended")
def get_recommended(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[UserInDB, Depends(get_current_user)]
  ) -> list[BookCard]:
  """
  Перелік рекомендованих книг 
  """    
  print("Get Recommended")

  userId: int = currentUser.userId
  print("userId=", userId)
    
  print("get_db_data....")
  dbData = get_db_data(conn)
  matrix = np.array(dbData["matrix"])
  
  print("get_user_vector....")
  userVector = get_user_vector(matrix, dbData["user_ids"], userId)
  print("userVector=", userVector)
  
  try:
    print("art1_clustering....")
    clustersART1 = art1_clustering(matrix)  
    print("clustersART1=", clustersART1)     
    
    print("make_recommendation....")   
    recommendations = make_recommendation(clustersART1, userVector, dbData["book_ids"]) 
    print("recommendations=", recommendations)
              
  except Exception: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, 
      detail="Помилка вибірки рекомендованих книг даних з БД: переконайтеся, що введені дані коректні")
  
  # За переліком ідентифікаторів книг обираємо дані по рекомендованим книгам з БД 
  if len(recommendations) > 0:
    return get_recommendation_data(recommendations, userId, conn)
    
  return []    
    
# -----------------------------------------
def get_db_data(conn: psycopg2.connect):
  
  try:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
          u.user_id,
          b.book_id,
          CASE WHEN r.ref_book_id IS NOT NULL THEN 1 ELSE 0 END AS has_read
        FROM books b
        CROSS JOIN users u
        LEFT JOIN reading r 
          ON r.ref_book_id = b.book_id 
          AND r.ref_user_id = u.user_id
        ORDER BY u.user_id, b.book_id""")
    rows = cursor.fetchall()
    cursor.close()
  
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки рекомендованих книг даних з БД: " + str(e))

  # Отримуємо унікальні user_id та book_id 
  user_ids = sorted(set(r[0] for r in rows))  
  book_ids = sorted(set(r[1] for r in rows))

  # Створюємо матрицю з нулями
  matrix = np.zeros((len(user_ids), len(book_ids)), dtype=int)

  # Заповнюємо ознаки читання
  for user_id, book_id, has_read in rows:
    i = user_ids.index(user_id)    
    j = book_ids.index(book_id)
    matrix[i, j] = has_read

  print("user_ids=", user_ids)
  print("book_ids=", book_ids)
  print("matrix=", matrix)

  return {
    "user_ids": user_ids,    
    "book_ids": book_ids,
    "matrix": matrix.tolist()  # для JSON-відповіді
  }

# -----------------------------------------
def get_user_vector(matrix: np.array, userIds: np.array, userId: int):
  try:
    row_idx = userIds.index(userId)
  except ValueError:
    raise KeyError(f"Користувач {userId} не знайдений")
  return matrix[row_idx]   # беремо рядок для користувача
  
# -----------------------------------------  
# Алгоритм кластеризації ART1. 
def art1_clustering(data, rho = 0.5): 
  # Контейнер для кластерів
  clustersART1 = [] 
  
  # Алгоритм кластеризації ART1
  for vector in data: 
    assigned = False 
    for cluster in clustersART1: 
      prototype = cluster[0] 
      intersection = np.bitwise_and(prototype, vector) 
      denominator = np.sum(vector)
      if denominator == 0:
        similarity = 0.0 
      else:
         similarity = np.sum(intersection) / denominator      
      
      if similarity >= rho: 
        cluster.append(vector) 
        assigned = True 
        break 

    if not assigned: 
      clustersART1.append([vector])

  # Повертаємо відповідний словник з біграмами
  return clustersART1 
 
# -----------------------------------------  
# Функція для рекомендації на базі винайдених кластерів та заданого вектору користувача
def make_recommendation(clusters, userVector, bookIds): 
  for cluster in clusters: 
    for member in cluster: 
      if np.array_equal(member, userVector): 
        common_items = np.bitwise_or.reduce(cluster) 
        recommendations = np.bitwise_xor(common_items, userVector) 
        recommendationsIdx = np.where(recommendations == 1)[0].tolist() 
        # За номерами індексів у масиві обираємо ідентифікатори книг в БД
        return [bookIds[i] for i in recommendationsIdx]
  return []

# -----------------------------------------  
# Функція повернення даних з БД за ідентифікаторами рекомендованих книг
def get_recommendation_data(
  recommBookIds: np.array, 
  userId: int,
  conn: psycopg2.connect) -> list[BookCard]:
  
  try:
    cursor = conn.cursor()
    sql = f"""SELECT b.book_id, b.book_name, b."ISBN", b.book_year, b.book_cover, b.book_cover_mime, b.ref_language_id, 
          COALESCE((select avg(grade) from ratings r where b.book_id=r.ref_book_id), 0) as rating,
          (select string_agg(CAST(ref_author_id AS text), ',') from link_authors_books a where b.book_id=a.ref_book_id) as authors,
          (select string_agg(CAST(ref_genre_id AS text), ',') from link_genres_books g where b.book_id=g.ref_book_id) as genres,
          annotation, key_words,
          (select source_link from sources s where b.book_id=s.ref_book_id limit 1) as source,
          CASE WHEN u.ref_user_id IS NULL THEN False ELSE True END is_favorite,
          r.created_at as start_reading, r.finished_at as finish_reading
    FROM books b 
    LEFT OUTER JOIN link_users_books u ON u.ref_book_id = b.book_id and u.ref_user_id=%s 
    LEFT OUTER JOIN reading r ON r.ref_book_id = b.book_id and r.ref_user_id=%s 
    WHERE b.book_id = ANY(%s::uuid[])    
    ORDER BY b.created_at DESC"""

    cursor.execute(sql, (userId, userId, recommBookIds))

    books: list[BookCard] = []
    for bookId, bookName, isbn, bookYear, bookCoverBytes, bookCoverMime, languageId, rating, authors, genres, annotation, keyWords, source, isFavorite, dateStartRead, dateFinishRead in cursor.fetchall():
      listAuthors = [int(authorId) for authorId in authors.split(",")]
      listGenres = [int(genreId) for genreId in genres.split(",")]
      # перетворюємо масив байтів в base64 строку
      bookCoverBase64: str = None
      if bookCoverBytes != None:
        bookCoverBase64 = bookCoverMime + "," + base64.b64encode(bookCoverBytes).decode('utf-8')

      books.append(
        BookCard(bookId=bookId,
                isbn=isbn,
                bookName=bookName,
                bookYear=bookYear,
                bookCover=bookCoverBase64,
                languageId=languageId,
                authors=listAuthors,
                genres=listGenres,
                rating=rating,
                annotation=annotation,
                keyWords=keyWords,
                source=source,
                isFavorite=isFavorite,
                dateStartRead=dateStartRead,
                dateFinishRead=dateFinishRead
          )) 

    cursor.close()
    conn.close()
     
    return books
           
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки рекомендованих книг даних з БД: " + str(e))
  
# def make_recommendation(clusters, userVector, bookIds, threshold=0.5):
#   """
#   clusters: список кластерів (кожен кластер = список numpy-векторів)
#   userVector: numpy-вектор користувача
#   threshold: мінімальна схожість для врахування (0..1)
#   """
#   best_cluster = None
#   best_similarity = 0

#   # шукаємо кластер з найбільш схожим учасником
#   for cluster in clusters:
#     for member in cluster:
#       # косинусна схожість
#       dot = np.dot(userVector, member)
#       norm = np.linalg.norm(userVector) * np.linalg.norm(member)
#       similarity = dot / norm if norm != 0 else 0

#       if similarity > best_similarity:
#         best_similarity = similarity
#         best_cluster = cluster

#   # якщо знайшли достатньо схожий кластер
#   if best_cluster is not None and best_similarity >= threshold:
#     common_items = np.bitwise_or.reduce(best_cluster)
#     recommendations = np.bitwise_xor(common_items, userVector)
      # recommendationsIdx = np.where(recommendations == 1)[0].tolist() 
      # return [bookIds[i] for i in recommendationsIdx]

#   return []
#--------------------------------------------------------------------------------------------------
