import psycopg2 
import os

# визначаємо залежність 
# функція get_db(), через яку об'єкт підключення до бази даних буде передаватися у функцію обробки
def get_db(): 
    # створюємо об'єкт підключення до бази даних
    conn = psycopg2.connect(
        dbname=os.getenv("dbName"), 
        user=os.getenv("user"), 
        password=os.getenv("password"), 
        host=os.getenv("host")) 
    try: 
        # yield  буде  виконуватися  при отриманні кожного нового запиту
        yield conn 
    finally: 
        conn.close() 
