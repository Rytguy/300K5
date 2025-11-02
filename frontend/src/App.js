import { useState, useEffect, useRef } from "react";
import "@/App.css";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Hexagon, ChevronDown, Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [books, setBooks] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [showEditBook, setShowEditBook] = useState(false);
  const [currentUser, setCurrentUser] = useState(1);
  const stardustRef = useRef([]);
  
  // Form states
  const [bookForm, setBookForm] = useState({ title: "", status: "To Read", rating: 5.0 });
  const [editBookForm, setEditBookForm] = useState({ title: "", status: "To Read", rating: 5.0, originalTitle: "" });
  const [quoteForm, setQuoteForm] = useState({ text: "", discussion: "" });
  const [editingBook, setEditingBook] = useState(null);

  useEffect(() => {
    fetchBooks();
    fetchQuotes();
    
    // Stardust effect
    const handleMouseMove = (e) => {
      const stardust = document.createElement('div');
      stardust.className = 'stardust-particle';
      stardust.style.left = e.clientX + 'px';
      stardust.style.top = e.clientY + 'px';
      document.body.appendChild(stardust);
      
      setTimeout(() => {
        stardust.remove();
      }, 1000);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${API}/books`);
      setBooks(response.data);
      // Save to localStorage for offline
      localStorage.setItem('books', JSON.stringify(response.data));
    } catch (e) {
      console.error(e);
      // Load from localStorage if offline
      const cached = localStorage.getItem('books');
      if (cached) setBooks(JSON.parse(cached));
      toast.error("Failed to fetch books");
    }
  };

  const fetchQuotes = async () => {
    try {
      const response = await axios.get(`${API}/quotes`);
      setQuotes(response.data);
      localStorage.setItem('quotes', JSON.stringify(response.data));
    } catch (e) {
      console.error(e);
      const cached = localStorage.getItem('quotes');
      if (cached) setQuotes(JSON.parse(cached));
      toast.error("Failed to fetch quotes");
    }
  };

  const fetchBooksWithQuotes = async () => {
    try {
      const response = await axios.get(`${API}/books-with-quotes`);
      setBooksWithQuotes(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const addBook = async () => {
    if (!bookForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      await axios.post(`${API}/books`, bookForm);
      toast.success("Book added successfully");
      setBookForm({ title: "", status: "To Read", rating: 5.0 });
      setShowAddBook(false);
      fetchBooks();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add book");
    }
  };

  const updateBook = async (title, updates) => {
    try {
      await axios.put(`${API}/books/${encodeURIComponent(title)}`, updates);
      toast.success("Book updated successfully");
      setEditingBook(null);
      fetchBooks();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update book");
    }
  };

  const deleteBook = async (title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await axios.delete(`${API}/books/${encodeURIComponent(title)}`);
      toast.success("Book deleted successfully");
      fetchBooks();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete book");
    }
  };

  const addQuote = async () => {
    if (!quoteForm.text.trim()) {
      toast.error("Quote text is required");
      return;
    }
    try {
      await axios.post(`${API}/quotes`, {
        book_title: selectedBook,
        text: quoteForm.text,
        user_id: currentUser,
        discussion: quoteForm.discussion
      });
      toast.success("Quote added successfully");
      setQuoteForm({ text: "", discussion: "" });
      setShowAddQuote(false);
      fetchQuotes();
      fetchBooksWithQuotes();
    } catch (e) {
      console.error(e);
      toast.error("Failed to add quote");
    }
  };

  const updateQuoteDiscussion = async (bookTitle, quoteText, discussion) => {
    try {
      await axios.put(`${API}/quotes/${encodeURIComponent(bookTitle)}/${encodeURIComponent(quoteText)}`, { discussion });
      toast.success("Discussion updated");
      fetchQuotes();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update discussion");
    }
  };

  const deleteQuote = async (bookTitle, quoteText) => {
    if (!window.confirm("Delete this quote?")) return;
    try {
      await axios.delete(`${API}/quotes/${encodeURIComponent(bookTitle)}/${encodeURIComponent(quoteText)}`);
      toast.success("Quote deleted successfully");
      fetchQuotes();
      fetchBooksWithQuotes();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete quote");
    }
  };

  const renderHexagons = (rating) => {
    const count = Math.round(rating);
    return (
      <div className="flex gap-1">
        {Array.from({ length: count }).map((_, i) => (
          <Hexagon key={i} className="w-4 h-4" fill="currentColor" />
        ))}
      </div>
    );
  };

  const getQuotesForBook = (bookTitle) => {
    return quotes.filter(q => q.book_title === bookTitle);
  };

  return (
    <div className="App min-h-screen">
      <div className="stardust-cursor"></div>
      
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="book-title" data-testid="main-heading">Books</h1>
        
        <div className="user-toggle" data-testid="user-toggle">
          <Button
            data-testid="user-1-btn"
            onClick={() => setCurrentUser(1)}
            className={currentUser === 1 ? 'active' : ''}
          >
            User 1
          </Button>
          <Button
            data-testid="user-2-btn"
            onClick={() => setCurrentUser(2)}
            className={currentUser === 2 ? 'active' : ''}
          >
            User 2
          </Button>
        </div>

        <Tabs defaultValue="books" className="tabs-container">
          <TabsList data-testid="main-tabs">
            <TabsTrigger value="books" data-testid="books-tab">Books</TabsTrigger>
            <TabsTrigger value="quotes" data-testid="quotes-tab">Quotes</TabsTrigger>
          </TabsList>

          <TabsContent value="books" data-testid="books-content">
            <Dialog open={showAddBook} onOpenChange={setShowAddBook}>
              <DialogTrigger asChild>
                <Button className="add-btn" data-testid="add-book-btn">
                  <Plus className="w-4 h-4" /> Add Book
                </Button>
              </DialogTrigger>
              <DialogContent className="dialog-content" data-testid="add-book-dialog">
                <DialogHeader>
                  <DialogTitle>Add New Book</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    data-testid="book-title-input"
                    placeholder="Book Title"
                    value={bookForm.title}
                    onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  />
                  <Select
                    value={bookForm.status}
                    onValueChange={(value) => setBookForm({ ...bookForm, status: value })}
                  >
                    <SelectTrigger data-testid="book-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="To Read" data-testid="status-to-read">To Read</SelectItem>
                      <SelectItem value="Reading" data-testid="status-reading">Reading</SelectItem>
                      <SelectItem value="Completed" data-testid="status-completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    data-testid="book-rating-input"
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="Rating (1.0-10.0)"
                    value={bookForm.rating}
                    onChange={(e) => setBookForm({ ...bookForm, rating: parseFloat(e.target.value) })}
                  />
                  <Button onClick={addBook} className="w-full" data-testid="submit-book-btn">Add Book</Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="books-table" data-testid="books-table">
              {books.map((book) => (
                <div key={book.title} className="book-row" data-testid={`book-row-${book.number}`}>
                  <div className="book-number" data-testid={`book-number-${book.number}`}>{book.number}</div>
                  <div className="book-title-cell" data-testid={`book-title-${book.number}`}>{book.title}</div>
                  <div className="book-status" data-testid={`book-status-${book.number}`}>
                    <Select
                      value={book.status}
                      onValueChange={(value) => updateBook(book.title, { status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="To Read">To Read</SelectItem>
                        <SelectItem value="Reading">Reading</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="book-rating" data-testid={`book-rating-${book.number}`}>
                    {editingBook === book.title ? (
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="10"
                        value={book.rating}
                        onChange={(e) => updateBook(book.title, { rating: parseFloat(e.target.value) })}
                        onBlur={() => setEditingBook(null)}
                        className="rating-input"
                      />
                    ) : (
                      <div onClick={() => setEditingBook(book.title)} className="hexagon-rating">
                        {renderHexagons(book.rating)}
                      </div>
                    )}
                  </div>
                  <div className="book-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBook(book.title)}
                      data-testid={`delete-book-${book.number}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="quotes" data-testid="quotes-content">
            <div className="quotes-section">
              <Dialog open={showAddQuote} onOpenChange={setShowAddQuote}>
                <DialogContent className="dialog-content" data-testid="add-quote-dialog">
                  <DialogHeader>
                    <DialogTitle>Add Quote to {selectedBook}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      data-testid="quote-text-input"
                      placeholder="Enter your favorite quote..."
                      value={quoteForm.text}
                      onChange={(e) => setQuoteForm({ ...quoteForm, text: e.target.value })}
                      rows={4}
                    />
                    <Textarea
                      data-testid="quote-discussion-input"
                      placeholder="Add your thoughts, discussions, or findings..."
                      value={quoteForm.discussion}
                      onChange={(e) => setQuoteForm({ ...quoteForm, discussion: e.target.value })}
                      rows={6}
                    />
                    <Button onClick={addQuote} className="w-full" data-testid="submit-quote-btn">Add Quote</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="quotes-grid" data-testid="quotes-grid">
                {booksWithQuotes.map((bookTitle) => (
                  <div
                    key={bookTitle}
                    className="quote-book-card"
                    onClick={() => {
                      setSelectedBook(bookTitle);
                      setShowAddQuote(true);
                    }}
                    data-testid={`quote-book-card-${bookTitle}`}
                  >
                    <h3>{bookTitle}</h3>
                    <p>{getQuotesForBook(bookTitle).length} quotes</p>
                    
                    <div className="quotes-list" onClick={(e) => e.stopPropagation()}>
                      {getQuotesForBook(bookTitle).map((quote, idx) => (
                        <Collapsible key={idx} className="quote-item" data-testid={`quote-item-${idx}`}>
                          <div className={`quote-text user-${quote.user_id}`} data-testid={`quote-text-${idx}`}>
                            "{quote.text}"
                          </div>
                          
                          {quote.discussion && (
                            <CollapsibleTrigger className="discussion-toggle" data-testid={`discussion-toggle-${idx}`}>
                              <ChevronDown className="w-4 h-4" />
                              Discussion
                            </CollapsibleTrigger>
                          )}
                          
                          <CollapsibleContent className="discussion-content" data-testid={`discussion-content-${idx}`}>
                            <div className="discussion-text">{quote.discussion}</div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteQuote(quote.book_title, quote.text)}
                              data-testid={`delete-quote-${idx}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;