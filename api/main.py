from app import app
from conn import * 
from routers.catalog import *
from routers.books import *
from routers.favorites import * 
from routers.reading import * 
from routers.user_token import *
from routers.book_content import *
from routers.statistic import *
from routers.ratings import *
from routers.recommended import * 
from models import *
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv 

# Дозволені джерела (origins) для кросдоменних запитів
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # не ставте "*" якщо використовуєте credentials
    allow_credentials=True,         # якщо потрібні cookies/Authorization заголовки
    allow_methods=["*"],            # або перелік: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers=["*"],            # або конкретні: ["Content-Type", "Authorization"]
)

# загрузка переменных из .env
load_dotenv()

@app.get("/") 
def main(): 
    return FileResponse("public/index.html") 
