from app import app
import psycopg2 
from fastapi import Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from pathlib import Path
from typing import Annotated
from conn import get_db
from routers.user_token import get_current_user
from models import *
import os

@app.get("/api/reading")
def read_book(currentUser: Annotated[UserInDB, Depends(get_current_user)],          
  fileName: str = Query()):
  """
  Отримання змісту книги, запис до БД інформації про початок читання
  """    
  folderPath: str = os.getenv("folderSource") 
  filePath: str = Path(folderPath) / fileName
  print(filePath)
  
  if not filePath.exists() or not filePath.is_file():
    raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail=f"Файл {fileName} не знайдений на сервері")

  # автоматично визначаємо розширення файлу
  extension = filePath.suffix.lower()  

  # Визначаємо media_type залежно від розширення
  if extension == ".pdf":
    mediaType = "application/pdf"
  elif extension == ".epub":
    mediaType = "application/epub+zip"
  else:
    mediaType = "application/octet-stream"  # універсальний варіант

  return FileResponse(
    filePath,
    media_type=mediaType,
    filename=fileName
  )
  
@app.post("/api/reading/start/{bookId}")
def mark_read_unread(currentUser: Annotated[UserInDB, Depends(get_current_user)],
        conn: Annotated[psycopg2.connect, Depends(get_db)],
        bookId: str) -> datetime | None:
  """
  Додавання книги до числа книг, що читає користувач
  """    
  print("Start reading")
  try:
    cursor = conn.cursor()
    print("userId=", currentUser.userId)
    # Перевiрка, що книга не додана в список книг, що читає користувач
    sql = """SELECT 1 FROM reading WHERE ref_book_id=%s AND ref_user_id=%s"""
    cursor.execute(sql, (bookId, currentUser.userId))

    row = cursor.fetchone() 
    if row == None:   
      nowDateTime = datetime.now()
      sql = """INSERT INTO reading(
                ref_book_id, ref_user_id, created_at)
              VALUES (%s, %s, %s)"""
      cursor.execute(sql, (bookId, currentUser.userId, nowDateTime))
      print("Added Reading Book")
      conn.commit()
      
    cursor.close()
    conn.close()  
    return  nowDateTime if row == None else None
  except psycopg2.Error as e: 
    raise HTTPException(status_code = 600, detail="Помилка вставки до БД інформації про читання: " + str(e))
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка додавання інформації про читання: " + str(e))        

@app.post("/api/reading/{bookId}/{isRead}")
def mark_read_unread(currentUser: Annotated[UserInDB, Depends(get_current_user)],
      conn: Annotated[psycopg2.connect, Depends(get_db)],
      bookId: str,
      isRead: int) -> datetime | None:
  """
  Додавання / зняття ознаки прочитаної книги
  """    
  print("Mark Read Unread")

  try:
    cursor = conn.cursor()
    # Перевiрка, що інформація про читання книги додана в таблицю reading
    sql = """SELECT 1 FROM reading WHERE ref_book_id=%s AND ref_user_id=%s"""
    cursor.execute(sql, (bookId, currentUser.userId))

    row = cursor.fetchone() 

    # якщо інформація не знайдена, відправляємо статусний код і повідомлення про помилку 
    if row == None:   
      raise HTTPException(status_code = status.HTTP_409_CONFLICT, 
                          detail="Відсутня інформація щодо читання книги користувачем")
    
    nowDateTime = datetime.now()
    sql = f"""UPDATE reading
            SET finished_at = {'%s' if isRead == 1 else 'null'}
            WHERE ref_book_id=%s AND ref_user_id = %s"""
    params: list = []
    # Якщо isRead == 1, то помітити прочитаним, оновлюємо дату завкінчення читання на поточну
    if (isRead == 1) :
        params.append(nowDateTime)
    params.append(bookId)
    params.append(currentUser.userId)
    print(sql, params)
    cursor.execute(sql, tuple(params))
    print("Updated reading")
      
    conn.commit() 

    return  nowDateTime if isRead == 1 else None
  except HTTPException:
    raise
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка оновлення інформації про читання в БД: " + str(e))
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка оновлення інформації про читання: " + str(e))    

@app.put("/api/reading/{bookId}/progress")
def update_reading_progress(
  currentUser: Annotated[UserInDB, Depends(get_current_user)],
  conn: Annotated[psycopg2.connect, Depends(get_db)],
  bookId: str,
  payload: ReadingProgress
):
  """
  Оновлення поточного прогресу читання книги (у сторінках та відсотках)
  """
  try:
    safe_current_page = payload.current_page
    progress_percent = round((payload.current_page / payload.total_pages) * 100, 2)

    cursor = conn.cursor()
    sql = """UPDATE reading
             SET current_page = %s, total_pages = %s, progress_percent = %s
             WHERE ref_book_id = %s AND ref_user_id = %s"""
    cursor.execute(sql, (safe_current_page, payload.total_pages or 0, progress_percent, bookId, currentUser.userId))
    conn.commit()
    cursor.close()
    conn.close()

    return {
      "bookId": bookId,
      "currentPage": safe_current_page,
      "totalPages": payload.total_pages or 0,
      "progressPercent": progress_percent
    }
  except psycopg2.Error as e:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Помилка оновлення прогресу в БД: " + str(e))
  except Exception as e:
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Помилка оновлення прогресу читання: " + str(e))
    
