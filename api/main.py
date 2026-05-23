from app import app
from conn import * 
from catalog import *
from books import *
from favorites import * 
from reading import * 
from user_token import *
from book_content import *
from statistic import *
from ratings import *
from recommended import * 
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
