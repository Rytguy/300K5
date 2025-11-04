from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class Book(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    title: str
    status: str  # "To Read" | "Reading" | "Completed"
    rating: float
    number: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BookCreate(BaseModel):
    title: str
    status: str
    rating: float

class BookUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    rating: Optional[float] = None

class Quote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    book_title: str
    text: str
    user_id: int  # 1 or 2
    discussion: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuoteCreate(BaseModel):
    book_title: str
    text: str
    user_id: int
    discussion: str = ""

class QuoteUpdate(BaseModel):
    text: Optional[str] = None
    discussion: Optional[str] = None

# Books endpoints
@api_router.get("/books", response_model=List[Book])
async def get_books():
    books = await db.books.find({}, {"_id": 0}).to_list(1000)
    for book in books:
        if isinstance(book.get('created_at'), str):
            book['created_at'] = datetime.fromisoformat(book['created_at'])
    # Sort by number
    books.sort(key=lambda x: x.get('number', 0))
    return books

@api_router.post("/books", response_model=Book)
async def create_book(input: BookCreate):
    # Get the highest number
    existing_books = await db.books.find({}, {"_id": 0, "number": 1}).to_list(1000)
    max_number = max([b.get('number', 0) for b in existing_books], default=0)
    
    book_dict = input.model_dump()
    book_dict['number'] = max_number + 1
    book_obj = Book(**book_dict)
    
    doc = book_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.books.insert_one(doc)

    # --- This code auto-creates a blank quote for that book ---
    blank_quote = {
        'book_title': book_obj.title,
        'text': '',  # Start with empty text, you can edit later in frontend
        'user_id': 1,  # Or whatever your logic/user system is
        'discussion': "",
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.quotes.insert_one(blank_quote)
    # ---
    
    return book_obj

@api_router.put("/books/{book_title}", response_model=Book)
async def update_book(book_title: str, input: BookUpdate):
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.books.find_one_and_update(
        {"title": book_title},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Book not found")
    
    result.pop('_id', None)
    if isinstance(result.get('created_at'), str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    
    return Book(**result)

@api_router.delete("/books/{book_title}")
async def delete_book(book_title: str):
    result = await db.books.delete_one({"title": book_title})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Renumber remaining books
    books = await db.books.find({}, {"_id": 0}).to_list(1000)
    books.sort(key=lambda x: x.get('number', 0))
    
    for idx, book in enumerate(books, 1):
        await db.books.update_one(
            {"title": book['title']},
            {"$set": {"number": idx}}
        )
    
    # NOTE: The original code did not delete quotes here, which is why the quote card remained.
    # The fix is purely on the frontend to ensure the quote card is rendered based on quotes, not books.
    
    return {"message": "Book deleted successfully"}

# Quotes endpoints
@api_router.get("/quotes", response_model=List[Quote])
async def get_quotes():
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(1000)
    for quote in quotes:
        if isinstance(quote.get('created_at'), str):
            quote['created_at'] = datetime.fromisoformat(quote['created_at'])
    return quotes

@api_router.get("/quotes/{book_title}", response_model=List[Quote])
async def get_quotes_by_book(book_title: str):
    quotes = await db.quotes.find({"book_title": book_title}, {"_id": 0}).to_list(1000)
    for quote in quotes:
        if isinstance(quote.get('created_at'), str):
            quote['created_at'] = datetime.fromisoformat(quote['created_at'])
    return quotes

@api_router.post("/quotes", response_model=Quote)
async def create_quote(input: QuoteCreate):
    quote_obj = Quote(**input.model_dump())
    
    doc = quote_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.quotes.insert_one(doc)
    return quote_obj

@api_router.put("/quotes/{book_title}/{quote_text}", response_model=Quote)
async def update_quote(book_title: str, quote_text: str, input: QuoteUpdate):
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.quotes.find_one_and_update(
        {"book_title": book_title, "text": quote_text},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    result.pop('_id', None)
    if isinstance(result.get('created_at'), str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    
    return Quote(**result)

@api_router.delete("/quotes/{book_title}/{quote_text}")
async def delete_quote(book_title: str, quote_text: str):
    result = await db.quotes.delete_one({"book_title": book_title, "text": quote_text})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    return {"message": "Quote deleted successfully"}

# MODIFIED ENDPOINT: Use aggregation to get distinct book titles from quotes
@api_router.get("/books-with-quotes", response_model=List[str])
async def get_books_with_quotes():
    # Use aggregation to get distinct book_title values from the quotes collection
    pipeline = [
        {"$group": {"_id": "$book_title"}},
        {"$project": {"_id": 0, "book_title": "$_id"}}
    ]
    book_titles_docs = await db.quotes.aggregate(pipeline).to_list(1000)
    book_titles = [doc['book_title'] for doc in book_titles_docs]
    return book_titles

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
