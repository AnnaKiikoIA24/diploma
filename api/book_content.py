from app import app
import psycopg2 
from fastapi import Depends, Query, HTTPException, UploadFile, File, status
from typing import Annotated
from models import *
from pathlib import Path
from conn import get_db
import os
from user_token import get_current_user

@app.post("/api/content")
async def uploadFile(currentUser: Annotated[UserInDB, Depends(get_current_user)],
            conn: Annotated[psycopg2.connect, Depends(get_db)],
            bookId: str = Query(),
            file: UploadFile = File(...)) -> str:
  """
  Завантаження файлу та збереження його на сервері
  """
  # Перевірка розширення
  extension: str = Path(file.filename).suffix.lower()
  if extension not in [".pdf", ".epub"]:
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail = "Неприпустимий формат файлу (підтримуються тільки PDF, EPUB)")

  # Шлях для збереження
  folderPath: str = os.getenv("folderSource") 
  folder = Path(folderPath)
  if not folder.exists() or not folder.is_dir():
    raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = f"Папка для збереження файлів {folderPath} не знайдена на сервері")
  fileName: str = bookId + extension
  filePath: str = folder / fileName

  # Зберігаємо файл
  with open(filePath, "wb") as f:
    content = await file.read()
    f.write(content)

  # Збереження інформації в БД
  try:
    sql = """INSERT INTO sources(ref_book_id, source_link)
            VALUES (%s, %s)"""
    cursor = conn.cursor()
    cursor.execute(sql, (bookId, fileName))
    print(f"New Source created: {fileName}")
      
    conn.commit()  
    cursor.close()
    conn.close()    

    return fileName        
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail = "Помилка вставки до БД: " + str(e))

@app.delete("/api/content")
async def uploadFile(currentUser: Annotated[UserInDB, Depends(get_current_user)],
            conn: Annotated[psycopg2.connect, Depends(get_db)],
            bookId: str = Query(),
            fileName: str = Query()) -> bool:
  """
  Видалення файлу зі сховища
  """
  # Шлях для збереження
  folderPath: str = os.getenv("folderSource") 
  filePath: str = Path(folderPath) / fileName
  
  if not filePath.exists() or not filePath.is_file():
    raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail=f"Файл {fileName} не знайдений на сервері")

  # Видаляємо файл
  try:
    filePath.unlink()  
  except Exception as e:
    raise HTTPException(status_code = status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Помика видалення файлу: {e}")
  
  # Збереження інформації в БД
  try:
    sql = """DELETE FROM sources
            WHERE ref_book_id=%s AND source_link=%s"""
    cursor = conn.cursor()
    cursor.execute(sql, (bookId, fileName))
    print("Source deleted")
      
    conn.commit()  
    cursor.close()
    conn.close()    

    return True        
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.status.HTTP_400_BAD_REQUEST, detail = "Помилка видалення з БД: " + str(e))