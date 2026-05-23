import { useRef, useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Panel, Toast } from 'primereact';
import BookCard from './BookCard';
import CommentList from '../comments/CommentList';
import RecommendedByBook from '../recommended/RecommendedByBook';
import { AppContext } from '../context/AppContext';
import './Book.css';
import { ratingNew } from '../../utils/ratings';

export default function BookDetails() {
  const navigate = useNavigate();  
  const { user } = useContext(AppContext);  
  const location = useLocation();
  const { bookCard  } = location.state || {};  
  const toast = useRef(null);

  // локальний state на основі початкового bookCard
  const [book, setBook] = useState(bookCard);  

  // коли змінюється bookCard у location.state → оновлюємо локальний state
  useEffect(() => {
    setBook(bookCard);
  }, [bookCard]);

  useEffect(() => { 
    if ((!user || !user.userId) && localStorage.getItem('jwtToken') !== "") {
      localStorage.removeItem("jwtToken");
      document.cookie = `refresh-token=; Max-Age=-1; Path=/; `;     
      if (window.location.pathname.startsWith("/book/details"))  
        navigate('/');
    }
  }, [user?.userId]) 

  // Оновлення даних після редагування книги
  const handleChange = (editedBook) => {
    setBook(prev => ({ ...prev, ...editedBook }));
  };  
  
  return (
    <div>
      <Toast ref={toast} />       
      <div className="grid align-items-start">
        <div className='col-12 md:col-5'>

          {/* Обрана книга */}
          <Panel className='no-border-panel mt-3' header={<><i className='pi pi-address-book'/> Обрана книга</>}>
            <BookCard bookCard={book} toastRef={toast} isReadOnly isDetailsFormat onChange={handleChange} />
            {book.annotation &&
            <small className='font-italic'>{book.annotation}</small>}
          </Panel>

          {/* Рекомендації */}
          <RecommendedByBook bookId={book.bookId} />
        </div>

        {/* Коментарі та рейтинг */}        
        <div className='col-12 md:col-7'>
          <CommentList bookId={book.bookId} toastRef={toast} 
          onChangeRating={(ratingBook) => { setBook({...book, "rating": ratingBook})} }/>          
        </div>
      </div>
    </div>
  );
}