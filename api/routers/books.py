from app import app
import psycopg2 
from fastapi import Depends, HTTPException, status, Query
from typing import Annotated, Optional
from conn import get_db
from routers.user_token import get_current_user, optional_current_user
from models import *
from meilisearch import Client
import base64
import os

@app.post("/api/meilisearch/index-books")
async def index_books(
  conn: Annotated[psycopg2.connect, Depends(get_db)]  
):
  """
  Переіндексація книг в контейнері Meilisearch
  """    
  print("Meilisearch: Index Books")  
  meili = Client(os.getenv("MEILISEARCH_URL") , "MASTER_KEY")
  try:
    # Перевіряємо, чи існує індекс
    try:
        index = meili.get_index("books")
        # очищаємо старі документи
        index.delete_all_documents()
        print("Старі документи видалені")

    except Exception:
        index = meili.create_index("books", {"primaryKey": "id"})
        print("Індекс books створений")
        
    cursor = conn.cursor()
    sql = """SELECT book_id, book_name, key_words, 
        string_agg(a.author_lastname, ',') as authors
      FROM books b, link_authors_books link_a_b, authors a
      WHERE b.book_id=link_a_b.ref_book_id
      AND link_a_b.ref_author_id=a.author_id
      GROUP BY book_id, book_name, key_words"""
    
    cursor.execute(sql)
    rows = cursor.fetchall()
    docs = [
      {"id": r[0], "book_name": r[1], "key_words": r[2], "authors": r[3]}
      for r in rows
    ]
    cursor.close()
    conn.close()

    print("Кількість книг:", len(docs))
    meili.index("books").add_documents(docs)
    return { "indexed": len(docs) }
  
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка переіндексації даних: " + str(e))

@app.get("/api/meilisearch/search")
async def search_books(searchStr: str):
  """
  Пошук книг за назвою та ключовими словами в контейнері Meilisearch
  """    
  print("Meilisearch: Search Books") 
  meili = Client(os.getenv("MEILISEARCH_URL") , "MASTER_KEY")   
  results = meili.index("books").search(searchStr, {
    "limit": 20,
    "attributesToHighlight": ["book_name", "key_words", "authors"]
  })
  return results["hits"]

@app.get("/api/books")
def get_books(conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[Optional[UserInDB], Depends(optional_current_user)],
  isMyBooksOnly: bool = Query(default = False), 
  offset: int = Query(default = 0),
  limit: int = Query(default = 50)):
  """
  Перелік книг
  """    
  print("Get Books: offset=", offset)

  userId: int = None
  if currentUser != None:
    userId = currentUser.userId
  print("userId=", userId)
  try:
    cursor = conn.cursor()

    # Загальна кількість книг користувача (обране користувача)
    totalUserRecords: int = 0
    if userId != None:
      sql = "SELECT COUNT(*) FROM link_users_books WHERE ref_user_id=%s"
      cursor.execute(sql, (userId,))
      totalUserRecords, = cursor.fetchone()  
    
    # Якщо обрано опцію "Мої книжки", то загальна кількість книжок дорівнює кількості книжок в обраному користувача
    if isMyBooksOnly == True and userId != None:
      totalRecords = totalUserRecords
    else:
      # Загальна кількість рядків (для пагінації на клієнті)
      sql = "SELECT COUNT(*) FROM books"
      cursor.execute(sql)
      totalRecords, = cursor.fetchone()   

    # Вибір порції даних
    sql = f"""SELECT b.book_id, b.book_name, b."ISBN", b.book_year, b.book_cover, b.book_cover_mime, b.ref_language_id, 
          COALESCE((select avg(grade) from ratings r where b.book_id=r.ref_book_id), 0) as rating,
          (select string_agg(CAST(ref_author_id AS text), ',') from link_authors_books a where b.book_id=a.ref_book_id) as authors,
          (select string_agg(CAST(ref_genre_id AS text), ',') from link_genres_books g where b.book_id=g.ref_book_id) as genres,
          annotation, key_words,
          (select source_link from sources s where b.book_id=s.ref_book_id limit 1) as source,
          CASE WHEN u.ref_user_id IS NULL THEN False ELSE True END is_favorite,
          r.created_at as start_reading, r.finished_at as finish_reading
    FROM books b {"INNER " if isMyBooksOnly == True and userId != None else "LEFT OUTER "}
    JOIN link_users_books u ON u.ref_book_id = b.book_id and u.ref_user_id=%s 
    LEFT OUTER JOIN reading r ON r.ref_book_id = b.book_id and r.ref_user_id=%s 
    ORDER BY b.created_at DESC
    LIMIT %s OFFSET %s"""

    paramUserId = userId if userId != None else -1
    cursor.execute(sql, (paramUserId, paramUserId, limit, offset))

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

    return {
      "totalRecords": totalRecords,
      "totalUserRecords": totalUserRecords,
      "items": books
    }
  
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки даних з БД: " + str(e))


@app.get("/api/books/{id}")
def get_book(
  conn: Annotated[psycopg2.connect, Depends(get_db)],  
  id: str) -> Book:    
  """
  Дані по обраній книзі
  """ 
  print("Get Book: bookId=", id)
  try:
    cursor = conn.cursor()
    # Вибір даних
    sql = f"""SELECT b.book_id, b.book_name, b."ISBN", b.book_year, b.book_cover, b.book_cover_mime, b.ref_language_id, 
          (select string_agg(CAST(ref_author_id AS text), ',') from link_authors_books a where b.book_id=a.ref_book_id) as authors,
          (select string_agg(CAST(ref_genre_id AS text), ',') from link_genres_books g where b.book_id=g.ref_book_id) as genres,
          annotation, key_words,
          (select source_link from sources s where b.book_id=s.ref_book_id limit 1) as source
    FROM books b
    WHERE b.book_id=%s"""
    cursor.execute(sql, (id,))
    row = cursor.fetchone() 

    # якщо книга не знайдена, відправляємо статусний код і повідомлення про помилку 
    if row == None:   
      raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail="Книга не знайдена в БД")
    
    bookId, bookName, isbn, bookYear, bookCoverBytes, bookCoverMime, languageId, authors, genres, annotation, keyWords, source = row
    cursor.close()
    conn.close()

    listAuthors = [int(authorId) for authorId in authors.split(",")]
    listGenres = [int(genreId) for genreId in genres.split(",")]
    # перетворюємо масив байтів в base64 строку
    bookCoverBase64: str = None
    if bookCoverBytes != None:
      bookCoverBase64 = bookCoverMime + "," + base64.b64encode(bookCoverBytes).decode('utf-8')
    
    return Book(
          bookId=bookId,
          isbn=isbn,
          bookName=bookName,
          bookYear=bookYear,
          bookCover=bookCoverBase64,
          languageId=languageId,
          authors=listAuthors,
          genres=listGenres,
          annotation=annotation,
          keyWords=keyWords,
          source=source
    )
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки даних з БД: " + str(e))
    

@app.post("/api/books")
def create_book(currentUser: Annotated[UserInDB, Depends(get_current_user)],
            conn: Annotated[psycopg2.connect, Depends(get_db)],
            book: Book) -> Book:
  """
  Створення нової книги
  """    
  print("Create New Book")

  coverImgData: bytes = None
  mimeType: str = None
  if book.bookCover != None:
    # декодуємо картинку обкладинки (що передана як base64)
    mimeType, encoded = book.bookCover.split(",", 1)
    # перетворюємо на масив байтів
    coverImgData = base64.b64decode(encoded)
  
  # генеруємо унікальний ідентифікатор книги
  book.bookId = uuid.uuid4();

  try:
    sql = """INSERT INTO books(
              book_id, "ISBN", book_name, book_year, book_cover, book_cover_mime, ref_language_id, annotation, key_words)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    cursor = conn.cursor()
    cursor.execute(sql, (str(book.bookId), book.isbn, 
                          book.bookName, book.bookYear, 
                          psycopg2.Binary(coverImgData), mimeType,
                          book.languageId, book.annotation, book.keyWords))
    print("New Book created")
    
    for authorId in book.authors:
      cursor.execute(
        "INSERT INTO link_authors_books (ref_book_id, ref_author_id) VALUES (%s, %s)",
          (str(book.bookId), authorId)
    )
    print("Authors added")

    for genreId in book.genres:
      cursor.execute(
        "INSERT INTO link_genres_books (ref_book_id, ref_genre_id) VALUES (%s, %s)",
          (str(book.bookId), genreId)
    )
    print("Genres added")
      
    conn.commit()  
    cursor.close()
    conn.close()

    return book        
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вставки до БД: " + str(e))

@app.put("/api/books")
def update_book(currentUser: Annotated[UserInDB, Depends(get_current_user)],
            conn: Annotated[psycopg2.connect, Depends(get_db)],
            book: Book) -> Book:
  """
  Редагування iснуючої книги
  """    
  print("Update Book")
  try:
    cursor = conn.cursor()
    # Перевiрка, що книга існує в БД
    sql = """SELECT 
          (select string_agg(CAST(ref_author_id AS text), ',') from link_authors_books a where b.book_id=a.ref_book_id) as authors,
          (select string_agg(CAST(ref_genre_id AS text), ',') from link_genres_books g where b.book_id=g.ref_book_id) as genres
      FROM books b WHERE b.book_id=%s"""
    cursor.execute(sql, (str(book.bookId),))

    row = cursor.fetchone() 

    # якщо книга не знайдеа, відправляємо статусний код і повідомлення про помилку 
    if row == None:   
      raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail="Книга не знайдена в БД")
    
    oldAuthors, oldGenres = row     
    oldListAuthors = [int(authorId) for authorId in oldAuthors.split(",")]
    oldListGenres = [int(genreId) for genreId in oldGenres.split(",")]

    coverImgData: bytes = None
    mimeType: str = None
    if book.bookCover != None:
      # декодуємо картинку обкладинки (що передана як base64)
      mimeType, encoded = book.bookCover.split(",", 1)
      # перетворюємо на масив байтів
      coverImgData = base64.b64decode(encoded)

    sql = """UPDATE books
              SET "ISBN"=%s, 
              book_name=%s, 
              book_year=%s, 
              book_cover=%s, 
              book_cover_mime=%s, 
              ref_language_id=%s,
              annotation=%s,
              key_words=%s
            WHERE book_id=%s"""
    cursor = conn.cursor()
    cursor.execute(sql, (book.isbn, 
                          book.bookName, book.bookYear, 
                          psycopg2.Binary(coverImgData), mimeType,
                          book.languageId, book.annotation, book.keyWords, 
                          str(book.bookId)))
    print("Book updated")

    # -------------Автори------------
    # пeретворюємо на множини
    oldSet = set(oldListAuthors)
    newSet = set(book.authors)

    # що видалити (були раніше, але відсутні у нових)
    toDelete = oldSet - newSet
    #print("toDelete", toDelete)

    # видалення      
    if toDelete:
      cursor.execute(
        "DELETE FROM link_authors_books WHERE ref_book_id = %s AND ref_author_id = ANY(%s)",
        (str(book.bookId), list(toDelete))
      )

    # кого додати (є в нових, але не було раніше)
    toInsert = newSet - oldSet
    # вставка
    for authorId in toInsert:
      cursor.execute(
        "INSERT INTO link_authors_books (ref_book_id, ref_author_id) VALUES (%s, %s)",
        (str(book.bookId), authorId)
      )
    print("Authors modified")

    # -------------Жанри------------
    # пeретворюємо на множини
    oldSet = set(oldListGenres)
    newSet = set(book.genres)
    # що видалити (були раніше, але відсутні у нових)
    toDelete = oldSet - newSet
    # видалення      
    if toDelete:
      cursor.execute(
        "DELETE FROM link_genres_books WHERE ref_book_id = %s AND ref_genre_id = ANY(%s)",
        (str(book.bookId), list(toDelete))
      )

    # кого додати (є в нових, але не було раніше)
    toInsert = newSet - oldSet
    # вставка
    for genreId in toInsert:
      cursor.execute(
        "INSERT INTO link_genres_books (ref_book_id, ref_genre_id) VALUES (%s, %s)",
        (str(book.bookId), genreId)
      )
    print("Genres modified")

    conn.commit()  
    cursor.close()
    conn.close()

    return book        
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка редагування даних в БД: " + str(e))
    

@app.delete("/api/books/{id}")
def delete_book(currentUser: Annotated[UserInDB, Depends(get_current_user)],
            conn: Annotated[psycopg2.connect, Depends(get_db)],
            id: str):
  """
  Видалення iснуючої книги
  """    
  print("Delete Book")
  try:
    cursor = conn.cursor()
    # Перевiрка, що книга існує в БД
    sql = """SELECT book_id FROM books b WHERE b.book_id=%s"""
    cursor.execute(sql, (id,))
    row = cursor.fetchone() 

    # якщо книга не знайдена, відправляємо статусний код і повідомлення про помилку 
    if row == None:   
      raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail="Книга не знайдена в БД")

    # Видалення книги (підлеглі записи видаляються каскадно через FK)
    sql = """DELETE FROM books b WHERE b.book_id=%s"""
    cursor.execute(sql, (id,))
    print("Book deleted")

    conn.commit()  
    cursor.close()
    conn.close()

  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка редагування даних в БД: " + str(e))      

@app.post("/api/filters/books")
def get_filters_books(
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  currentUser: Annotated[Optional[UserInDB], Depends(optional_current_user)],
  filters: Optional[Filters],
  isMyBooksOnly: bool = Query(default = False), 
  offset: int = Query(default = 0),
  limit: int = Query(default = 50)):
  """
  Перелік відфільтрованих книг
  """    
  print("Get Filters Books: offset=", offset)

  userId: int = None
  if currentUser != None:
    userId = currentUser.userId
  print("userId=", userId)
  
  try:
    cursor = conn.cursor()
    # Строка умови SQL-запиту
    filtersStr: str = f"""FROM books b 
      {"INNER " if isMyBooksOnly == True and userId != None else "LEFT OUTER "} 
      JOIN link_users_books u ON u.ref_book_id = b.book_id AND ref_user_id=%s
      LEFT OUTER JOIN ratings r ON r.ref_book_id = b.book_id
      LEFT OUTER JOIN reading read ON read.ref_book_id = b.book_id AND read.ref_user_id=%s
      WHERE b.book_year between %s and %s"""
    
    # параметри запиту
    paramUserId = userId if userId != None else -1
    params = [paramUserId, paramUserId, filters.minYear, filters.maxYear]
    
    # якщо при фільтрації введена назва
    if filters.bookName != None and filters.bookName != "":
      filtersStr += " AND Upper(b.book_name) like Upper(%s)"
      params.append(filters.bookName)

    # якщо при фільтрації обрані мови
    if filters.languages != None and len(filters.languages) > 0:
      filtersStr += " AND b.ref_language_id = ANY(%s)"
      params.append(filters.languages)
    
    # якщо при фільтрації обрані автори      
    if filters.authors != None and len(filters.authors) > 0:
      filtersStr += " AND b.book_id IN (select ref_book_id from link_authors_books a where a.ref_author_id = ANY(%s))"
      params.append(filters.authors)
    
    # якщо при фільтрації обрані жанри       
    if filters.genres != None and len(filters.genres) > 0:
      filtersStr += " AND b.book_id IN (select ref_book_id from link_genres_books g where g.ref_genre_id = ANY(%s))"
      params.append(filters.genres)

    # якщо при фільтрації обрані прочитані, у процесі читання або непрочитані книги       
    print("isRead=", filters.isRead)
    # якщо не всі
    if filters.isRead != -1:
      # прочитані
      if filters.isRead == 1:
        filtersStr += " AND read.finished_at is not null" 
      # у процесі читання
      elif filters.isRead == 2:
        filtersStr += " AND read.created_at is not null AND read.finished_at is null"
      # непрочитані
      else:
        filtersStr += " AND read.created_at is null"

      
    # якщо заданий рейтинг, то формуємо строку умови в блоці HAVING,
    # бо ми порівнюємо середній рейтинг книги
    raitingFilterStr: str = ""
    if filters.rating > 0:
      raitingFilterStr = " HAVING COALESCE(avg(grade), 0) >= %s"
      params.append(filters.rating)

    # Загальна кількість відфільтрованих рядків (для пагінації на клієнті)
    sql = f"""SELECT COUNT(*) FROM ( 
          SELECT book_id 
          {filtersStr}
          GROUP BY b.book_id
          {raitingFilterStr}
      )"""
    cursor.execute(sql, tuple(params))
    totalRecords, = cursor.fetchone()   

    # Загальна кількість книг користувача (обране користувача)
    totalUserRecords: int = 0
    if userId != None:
      # якщо вибираються лише книги з обраного, то кількість книг користувача дорівнює загальній квлькості
      if isMyBooksOnly == True:
        totalUserRecords = totalRecords
      else:
        sql = f"""SELECT COUNT(*) FROM (
                  SELECT book_id 
                  {filtersStr} 
                  AND u.ref_user_id = %s
                  GROUP BY b.book_id
                  {raitingFilterStr}
          )"""
      
        #print("sql=", sql)
        paramsAdd: list[int] = list(params)
        # якщо фільтр за рейтингом заданий, параметр користувача вставляємо перед параметром рейтингу, 
        # бо той має бути в кінці
        if filters.rating > 0:
          paramsAdd.insert(len(paramsAdd) - 1, userId)
        else:
          paramsAdd.append(userId)

        print(paramsAdd)
        cursor.execute(sql, tuple(paramsAdd))
        totalUserRecords, = cursor.fetchone()        

    # Вибір порції даних
    sql = f"""SELECT b.book_id, b.book_name, b."ISBN", b.book_year, b.book_cover, b.book_cover_mime, b.ref_language_id, 
          COALESCE(avg(grade), 0) as rating,
          (select string_agg(CAST(ref_author_id AS text), ',') from link_authors_books a where b.book_id=a.ref_book_id) as authors,
          (select string_agg(CAST(ref_genre_id AS text), ',') from link_genres_books g where b.book_id=g.ref_book_id) as genres,
          annotation, key_words,
          (select source_link from sources s where b.book_id=s.ref_book_id limit 1) as source,
          CASE WHEN u.ref_user_id IS NULL THEN False ELSE True END is_favorite,
          read.created_at as start_reading, read.finished_at as finish_reading
    {filtersStr}
    GROUP BY b.book_id, b.book_name, b."ISBN", b.book_year, b.book_cover, b.book_cover_mime, b.ref_language_id, annotation, key_words,
          CASE WHEN u.ref_user_id IS NULL THEN False ELSE True END, read.created_at, read.finished_at
    {raitingFilterStr}
    ORDER BY b.created_at DESC
    LIMIT %s OFFSET %s"""
  
    params.append(limit)
    params.append(offset)
    print("sql=", sql)      
    print("params=", params)
    cursor.execute(sql, tuple(params))

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

    return {
      "totalRecords": totalRecords,
      "totalUserRecords": totalUserRecords,
      "items": books
    }
  
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки даних з БД: " + str(e))



