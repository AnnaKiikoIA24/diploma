from app import app
from models import *
from typing import Annotated
import psycopg2
from fastapi.responses import Response
from conn import get_db
from fastapi import Depends, HTTPException, status

# Отримання даних каталогів довідкової інформації
@app.get("/api/catalogs")
async def get_catalogs(response: Response,
    conn: Annotated[psycopg2.connect, Depends(get_db)]):
  """
  Отримання даних каталогів довідкової інформації
  """        
  print("Get Languages")
  
  try:
    cursor = conn.cursor()  
    sql = """SELECT l.language_id, l.language_name, l.language_code
            FROM languages l
            ORDER BY l.language_name"""
    cursor.execute(sql)

    languages = []
    for languageId, languageName, languageCode in cursor.fetchall():
      languages.append(
        CatalogItem(id = languageId, name = languageName, code = languageCode))

    print("Get Authors")
    sql = """SELECT a.author_id, a.author_firstname, a.author_lastname
            FROM authors a
            ORDER BY a.author_lastname"""
    cursor.execute(sql)

    authors = []
    for authorId, firstName, lastName in cursor.fetchall():
      authors.append(
        CatalogItem(id = authorId, name = firstName + " " + lastName))

    print("Get Genres")
    sql = """SELECT g.genre_id, g.genre_name
            FROM genres g
            ORDER BY g.genre_name"""
    cursor.execute(sql)

    genres = []
    for genreId, genreName in cursor.fetchall():
      genres.append(
        CatalogItem(id = genreId, name = genreName))

    cursor.close()
    conn.close()

    return {
      "languages": languages,
      "authors": authors,
      "genres": genres
    }
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка вибірки даних з БД: " + str(e))
  

