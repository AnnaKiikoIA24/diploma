from app import app
import psycopg2 
from fastapi import Depends, HTTPException, status
from typing import Annotated
from conn import get_db
from routers.user_token import get_current_user
from models import *

@app.post("/api/favorites/{bookId}")
def add_favourite(currentUser: Annotated[UserInDB, Depends(get_current_user)],
          conn: Annotated[psycopg2.connect, Depends(get_db)],
          bookId: str) -> bool:
  """
  Додавання книги до улюблених книг користувача
  """    
  print("Add New Favorite")

  try:
    cursor = conn.cursor()
    # Перевiрка, що книга не додана в обране для заданого користувача
    sql = """SELECT 1 FROM link_users_books WHERE ref_book_id=%s AND ref_user_id=%s"""
    cursor.execute(sql, (bookId, currentUser.userId))

    row = cursor.fetchone() 

    # якщо книга знайдена, відправляємо статусний код і повідомлення про помилку 
    if row != None:   
      raise HTTPException(status_code = status.HTTP_409_CONFLICT, detail="Книга вже додана до списку книг користувача")

    sql = """INSERT INTO link_users_books(
              ref_book_id, ref_user_id)
            VALUES (%s, %s)"""
    cursor.execute(sql, (bookId, currentUser.userId))
    print("Added Favorite Book")
      
    conn.commit()  

    # Загальна кількість книг з обраного заданого користувача
    # Закоментовано, бо треба відбирати з урахуванням фільтрів (це робимо на клієнті)
    # sql = """SELECT COUNT(*) FROM link_users_books WHERE ref_user_id=%s"""
    # cursor.execute(sql, (currentUser.userId,))

    # cntFavorites, = cursor.fetchone()  
    cursor.close()
    conn.close()

    return True #cntFavorites
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вставки до БД: " + str(e))
    
@app.delete("/api/favorites/{bookId}")
def delete_favourite(currentUser: Annotated[UserInDB, Depends(get_current_user)],
          conn: Annotated[psycopg2.connect, Depends(get_db)],
          bookId: str) -> bool:
  """
  Видалення книги зі списку улюблених книг користувача
  """    
  print("Delete Favorite")

  try:
    cursor = conn.cursor()
    # Перевiрка, що книга не додана в обране для заданого користувача
    sql = """SELECT 1 FROM link_users_books WHERE ref_book_id=%s AND ref_user_id=%s"""
    cursor.execute(sql, (bookId, currentUser.userId))

    row = cursor.fetchone() 

    # якщо книга не знайдена, відправляємо статусний код і повідомлення про помилку 
    if row == None:   
      raise HTTPException(status_code = status.HTTP_409_CONFLICT, detail="Книга не знайдена у списку книг користувача")

    sql = """DELETE FROM link_users_books
              WHERE ref_book_id=%s AND ref_user_id=%s"""
    cursor.execute(sql, (bookId, currentUser.userId))
    print("Deleted Favorite Book")
      
    conn.commit()  

    # Загальна кількість книг з обраного заданого користувача
    # Закоментовано, бо треба відбирати з урахуванням фільтрів (це робимо на клієнті)
    # sql = """SELECT COUNT(*) FROM link_users_books WHERE ref_user_id=%s"""
    # cursor.execute(sql, (currentUser.userId,))

    # cntFavorites, = cursor.fetchone()  
    cursor.close()
    conn.close()

    return True #cntFavorites
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка видалення з БД: " + str(e))
