from app import app
import psycopg2 
from fastapi import Depends, HTTPException, status, Body, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import Response
from typing import Annotated, Optional
import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta, timezone
import os
from conn import get_db
from models import *
from pwdlib import PasswordHash

from google.oauth2 import id_token
from google.auth.transport import requests

# OAuth2 схема, зберігає дані після виклику методу за url=login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Повертає екземпляр PasswordHash з рекомендованими хешерами
password_hash = PasswordHash.recommended()

# Перевірка пароля та хеш-пароля
def verify_password(plain_password, hashed_password) -> bool:
    return password_hash.verify(plain_password, hashed_password)

# Хешує пароль, використовуючи поточний хешер
def get_password_hash(password) -> str:
    return password_hash.hash(password)

# Функція генерації токена
def generate_jwt_token(data: dict, key: str, expiresDelta: timedelta | None = None) -> str:
    toEncode = data.copy()
    if expiresDelta:
        expire = datetime.now(timezone.utc) + expiresDelta
    else:
        # За замовчуванням термін 30 хвилин від поточної дати/часу
        expire = datetime.now(timezone.utc) + timedelta(minutes = 30)
    toEncode.update({"exp": expire})
    encodedJwt = jwt.encode(toEncode, key, algorithm = os.getenv("ALGORITHM"))
    return encodedJwt

# Функція створення об'єкта access-токена
def create_access_token(username: str) -> Token:
    accessTokenExpires = timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)
    # Створюємо токен з терміном дії ACCESS_TOKEN_EXPIRE_MINUTES і шифром SECRET_KEY
    accessToken = generate_jwt_token(
        data = {"sub": username}, 
        key = os.getenv("SECRET_KEY"), 
        expiresDelta = accessTokenExpires)
    
    return Token(access_token = accessToken, token_type = "bearer")

# Функція створення строки refresh-токена
def create_refresh_token_data(response: Response, username: str) -> str:
    refreshTokenExpires = timedelta(days = 30)
    # Створюємо токен з терміном дії 30 днів і шифром REFRESH_KEY
    refreshToken = generate_jwt_token(
        data = {"sub": username}, 
        key = os.getenv("REFRESH_KEY"), 
        expiresDelta = refreshTokenExpires)
    # зберігаємо в cookie refresh-token
    response.set_cookie(
        key = "refresh_token",
        value = refreshToken,
        httponly = True,
        secure = True,
        samesite = "lax",
        max_age = 2592000 # це 30 діб
    ) 

# Оновлення access_token через refresh_token
@app.post("/api/auth/refresh")
async def refresh_tokens(request: Request):
    """
    Оновлення токену для доступу
    """    
    print("Refresh Token") 
    try:
        # Декодуємо refresh-token
        payload = jwt.decode(
            request.cookies["refresh_token"],
            os.getenv("REFRESH_KEY"),
            algorithms = [os.getenv("ALGORITHM")]
        )
        # отримуємо логін
        username = payload["sub"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, 
                            detail="Invalid refresh token")
    # створюємо access token з оновленим терміном дії
    newAccessToken = create_access_token(username)
    return newAccessToken

# Функція перевірки токена (повертає username)
async def verify_jwt_token(token: str, request) -> str:
    # Створюємо об'єкт HTTPException з кодом 401
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не вдалося перевірити облікові дані",
        headers={"WWW-Authenticate": "Bearer"}
    )    
    try:
        if token == None:
            raise InvalidTokenError        
        SECRET_KEY = os.getenv("SECRET_KEY")
        payload = jwt.decode(token, SECRET_KEY, algorithms = [os.getenv("ALGORITHM")])
        username: str = payload.get("sub")
        if username is None:
            raise InvalidTokenError
        return username
    #  якщо токен прострочений
    except jwt.ExpiredSignatureError:
        # формуємо новий access_token на основі refresh_token
        newToken = await refresh_tokens(request)
        if newToken == None:
            raise credentials_exception
        # Розшифровуємо дані
        payload = jwt.decode(newToken.access_token, SECRET_KEY, algorithms = [os.getenv("ALGORITHM")])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except jwt.InvalidTokenError:
        raise credentials_exception

# Функція отримання інформації про користувача з БД
def get_user(conn, username: str) -> UserInDB:
  # отримуємо користувача за username
  cursor = conn.cursor()
  sql = """SELECT user_id, password, first_name, last_name, role, external_account,
          (select count(*) from link_users_books where ref_user_id = u.user_id) as favorites_cnt
      FROM users u WHERE login = %s """
  cursor.execute(sql, (username,))
  row = cursor.fetchone() 
  cursor.close() 

  if row == None:  
      return None
  
  userId, hashedPassword, firstName, lastName, role, externalAccount, favoritesCnt = row 
  return UserInDB(userId = userId, username = username, 
                  firstName = firstName, lastName = lastName, 
                  role = role, externalAccount= externalAccount, 
                  favoritesCnt=favoritesCnt,
                  hashedPassword = hashedPassword)

# Функція аутентифікації користувача в БД за його логіном та паролем
def authenticate_user(conn, username: str, password: str):
  # Перевірка, що користувач із заданим username є в БД
  user = get_user(conn, username)
  # Якщо це зовнішній обліковий користувача, потрібна авторизація через відповідний сервіс
  if user.externalAccount == True:
    return False
  # Якщо користувач не знайдений в БД
  if not user:
    return False
  # Якщо введено неправильний пароль
  if not verify_password(password, user.hashedPassword):
    return False
  return user

# Отримати поточного користувача за токеном
async def get_current_user(
        request: Request,
        token: Annotated[str, Depends(oauth2_scheme)],
        conn: Annotated[psycopg2.connect, Depends(get_db)]) -> UserInDB:
  
  # Створюємо об'єкт HTTPException з кодом 401
  credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Не вдалося перевірити облікові дані",
    headers={"WWW-Authenticate": "Bearer"}
  )
  if token == None:
    raise InvalidTokenError
  username: str = await verify_jwt_token(token, request)
  tokenData = TokenData(username = username)

  # За визначеним логіном отримуємо дані з БД
  user = get_user(conn = conn, username = tokenData.username)
  # Якщо користувач не знайдений в БД, кидаємо exception
  if user is None:
    raise credentials_exception
  return user

# Отримати (опціонально) поточного користувача або None за токеном
async def optional_current_user(request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    conn: Annotated[psycopg2.connect, Depends(get_db)] = None) -> Optional[UserInDB]:
  
  if token is None:
    return None
  try:
    return await get_current_user(request, token, conn)
  except HTTPException:
    return None

# ---------------------------------------------------  
# Вхід в систему за логіном/паролем
@app.post("/api/auth/login")
async def login_pwd_auth(response: Response,
  formData: Annotated[OAuth2PasswordRequestForm, Depends()],
  conn: Annotated[psycopg2.connect, Depends(get_db)]) -> UserOutData:
  """
  Вхід в систему за логіном/паролем
  """        
  print("Login User")
  # Автентифікуємо користувача за його логіном та паролем та повертаємо інф. з БД
  user = authenticate_user(conn, formData.username, formData.password)
  if not user:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Неправильне ім'я користувача або пароль.",
      headers={"WWW-Authenticate": "Bearer"}
    )
  # Створюємо access-токен
  accessToken = create_access_token(user.username) 
  # Створюємо та зберігаємо в cookie refresh-token    
  create_refresh_token_data(response, user.username)

  return UserOutData(
    # приводимо user класу UserInDb до базового класу
    user = User(**user.model_dump(exclude={"hashedPassword"})),
    token = accessToken)

# ---------------------------------------------------  
# Вхід в систему за іменем користувача/паролем
@app.post("/api/auth/google")
async def google_auth(token: GoogleTokenData,
    response: Response,
    conn: Annotated[psycopg2.connect, Depends(get_db)]):
  """
  Вхід за Google Account 
  """ 
  print("Google Account")   
  try:
    idinfo = id_token.verify_oauth2_token(
      token.credential,
      requests.Request(),
      os.getenv("GOOGLE_CLIENT_ID")
    )
  except Exception:
    raise HTTPException(status_code = status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

  # дані профілю користувача Google
  username = idinfo["email"]
  firstName = idinfo.get("name")
  #picture = idinfo.get("picture")

  dbUser = get_user(conn, username)
  # Створення нового користувача в БД, якщо він не знайдений
  if not dbUser:
    print("Створення нового користувача")
    cursor = conn.cursor()
    sql = """INSERT INTO users(
            login, first_name, role, external_account)
            VALUES (%s, %s, %s, %s)"""
    cursor.execute(sql, (username, firstName, False, True))
    conn.commit() 

    # отримуємо поточне значення user_id з відповідної послідовності
    sql = """SELECT currval('users_user_id_seq')"""
    cursor.execute(sql)
    userId = cursor.fetchone()  
    cursor.close()
    conn.close()
    
    dbUser = UserInDB(userId = userId, 
                    username = username, 
                    firstName = firstName, 
                    role = False,
                    externalAccount = True)
  
  # Якщо знайдений локальний користувач з таким логіном
  if not dbUser.externalAccount:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Зареєстрований локальний обліковий запис з таким логіном!",
      headers={"WWW-Authenticate": "Bearer"}
    )
  
  # Створюємо access-токен
  accessToken = create_access_token(dbUser.username) 
  # Створюємо та зберігаємо в cookie refresh-token    
  create_refresh_token_data(response, dbUser.username)

  return UserOutData(
    # приводимо user класу UserInDb до базового класу
    user = User(**dbUser.model_dump(exclude={"hashedPassword"})),
    token = accessToken)

# ---------------------------------------------------   
# Cтворення нового користувача 
@app.post("/api/users") 
def create_user(response: Response,
    conn: Annotated[psycopg2.connect, Depends(get_db)],                
    username: str = Body(embed=True),
    password: str = Body(embed=True, min_length = 4),
    lastName: str = Body(embed=True),
    firstName: str = Body(embed=True),
    role: bool = Body(embed=True, default=False)) -> UserOutData: 
  """
  Створення нового користувача
  """    
  print("Create New User")

  # отримуємо користувача за login 
  sql = """SELECT user_id  
          FROM users  
          WHERE login = %s"""  
  cursor = conn.cursor()
  cursor.execute(sql, (username,))
  row = cursor.fetchone()   

  if row != None:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Користувач " + username + " уже існує!",
      headers={"WWW-Authenticate": "Bearer"}
    )
  
  sql = """INSERT INTO users(
        login, password, first_name, last_name, role, external_account)
        VALUES (%s, %s, %s, %s, %s, %s)"""
  cursor.execute(sql, (username, get_password_hash(password), firstName, lastName, role, False))
  conn.commit() 

  # отримуємо поточне значення user_id з відповідної послідовності
  sql = """SELECT currval('users_user_id_seq')"""
  cursor.execute(sql)
  userId, = cursor.fetchone()  
  cursor.close()
  conn.close()
  
  newUser = User(userId=userId, username=username, 
                firstName=firstName, lastName=lastName, 
                role=role, externalAccount=False)
  # Створюємо access-токен
  accessToken = create_access_token(username)
  # Створюємо та зберігаємо в cookie refresh-token    
  create_refresh_token_data(response, username)
  return UserOutData(user=newUser, token=accessToken)

# ---------------------------------------------------   
# Зміна даних користувача
@app.put("/api/users") 
def edit_user(response: Response,
    currentUser: Annotated[UserInDB, Depends(get_current_user)],
    conn: Annotated[psycopg2.connect, Depends(get_db)],
    userId: int = Body(embed=True),
    username: str  = Body(embed=True),
    oldPassword: str = Body(embed=True, min_length = 4),
    password: str = Body(embed=True, min_length = 4),
    lastName: str = Body(embed=True),
    firstName: str = Body(embed=True),
    favoritesCnt: int = Body(embed=True)) -> UserOutData:
  """
  Зміна даних користувача
  """   
  print("Edit User Data")  
  # Перевірка правильності введення старого паролю
  if not verify_password(oldPassword, currentUser.hashedPassword):
    raise HTTPException(
      status_code=status.HTTP_412_PRECONDITION_FAILED,
      detail="Cтарий пароль не підтверджений!",
      headers={"WWW-Authenticate": "Bearer"}) 
      
  cursor = conn.cursor()
  # отримуємо користувача за новим login 
  sql = """SELECT user_id  
          FROM users  
          WHERE login = %s AND user_id <> %s """  
  cursor = conn.cursor()
  cursor.execute(sql, (username, userId))
  row = cursor.fetchone()   
  if row != None:
      raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="З логіном " + username + " вже існує інший користувач!",
        headers={"WWW-Authenticate": "Bearer"})
      
  # отримуємо користувача за id 
  sql = f"SELECT role FROM users WHERE user_id = {userId}" 
  cursor.execute(sql)
  row = cursor.fetchone()   
  # якщо не знайдений, відправляємо статусний код і повідомлення про помилку 
  if row == None:  
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Користувач з userId=" + userId + " не знайдений!",
      headers={"WWW-Authenticate": "Bearer"})        

  role, = row   
  # якщо користувач знайдений, змінюємо його дані і відправляємо назад клієнту 
  sql = """UPDATE users 
  SET login = %s, 
      password = %s,
      first_name = %s,
      last_name = %s
  WHERE user_id = %s"""
  cursor.execute(sql, (username, get_password_hash(password), firstName, lastName, userId))
  conn.commit()
  cursor.close()
  conn.close()
      
  editedUser = User(userId=userId, username=username, 
                  firstName=firstName, lastName=lastName, 
                  role=role, favoritesCnt=favoritesCnt)
  # Створюємо access-токен
  accessToken = create_access_token(username)
  # Створюємо та зберігаємо в cookie refresh-token    
  create_refresh_token_data(response, username)

  return UserOutData(user=editedUser, token=accessToken)

# ---------------------------------------------------   
# видалення користувача
@app.delete("/api/users/{userId}") 
def delete_user(userId, 
    currentUser: Annotated[UserInDB, Depends(get_current_user)],
    conn: Annotated[psycopg2.connect, Depends(get_db)]): 
  """
  Видалення користувача
  """
  cursor = conn.cursor()
  # отримуємо користувача за id 
  sql = f"SELECT user_id FROM users WHERE user_id = {userId}" 
  cursor.execute(sql)
  row = cursor.fetchone()   

  # якщо не знайдений, відправляємо статусний код і повідомлення про помилку 
  if row == None:  
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Користувач не знайдений!",
      headers={"WWW-Authenticate": "Bearer"})
  
  try:
    # якщо користувача знайдено, видаляємо його 
    sql = f"DELETE FROM users WHERE user_id = {userId}"
    cursor.execute(sql)
    conn.commit()
    cursor.close()
    conn.close()

    return 
  except psycopg2.Error as e: 
    raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Помилка видалення користувача з БД: " + str(e))

@app.get("/api/users/me/")
async def read_users_me(
  currentUser: Annotated[User, Depends(get_current_user)],) -> User:
  return User(**currentUser.model_dump(exclude={"hashedPassword"}))


