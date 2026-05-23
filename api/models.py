from pydantic import BaseModel
import uuid
from datetime import datetime, timedelta, timezone


# Моделі
class User(BaseModel):
  userId: int
  username: str
  firstName: str
  lastName: str | None = None
  role: bool | None = False,
  externalAccount: bool | None = False,
  favoritesCnt: int | None = 0

class UserInDB(User):
  hashedPassword: str | None = None

class Token(BaseModel):
  access_token: str
  token_type: str

class TokenData(BaseModel):
  username: str | None = None  

class GoogleTokenData(BaseModel):
  credential: str

class UserOutData(BaseModel):
  user: User
  token: Token

class CatalogItem(BaseModel):
  id: int
  name: str
  code: str | None = None

class Book(BaseModel):
  bookId: uuid.UUID | None = None
  bookName: str
  bookCover: str | None = None
  isbn: int | None = None 
  languageId: int
  authors: list[int]
  bookYear: int
  genres: list[int]
  annotation: str | None = None
  keyWords: str | None = None
  source: str | None = None

class BookCard(Book):
  rating: float | None = 0
  isFavorite: bool | None = False
  dateStartRead: datetime | None = None
  dateFinishRead: datetime | None = None

class Filters(BaseModel):
  bookName: str | None = None
  minYear: int | None = 0
  maxYear: int | None = 0
  languages: list[int] | None = None
  authors: list[int] | None = None
  genres: list[int] | None = None
  rating: int | None = 0,
  isRead: int | None = -1

class Favorite(BaseModel):
  bookId: uuid.UUID
  userId: int

class Rating(BaseModel):
  ratingId: int | None = None
  userId: int
  bookId: uuid.UUID
  grade: int | None = None
  review: str | None = None
  createdAt: datetime | None = None
  isEdit: bool | None = False

class RatingComment(Rating):
  owner: bool = False
  userName: str