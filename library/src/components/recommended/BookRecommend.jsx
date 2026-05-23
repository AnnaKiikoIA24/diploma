import { useEffect, useState, useRef, useContext } from 'react';
import { DataView, Button, Paginator, Toast, Message, Dialog } from 'primereact';
import { AppContext } from '../context/AppContext';
import BookCard from '../books/BookCard';
import {useNavigate} from "react-router-dom";
import { getRecommended } from '../../utils/recommended';
import '../books/Book.css'


export default function BookRecommend() {
  const navigate = useNavigate();
  const { user } = useContext(AppContext);  

  // масив книг
  const [ books, setBooks ] = useState([]);
  // ознака процеса завантаження даних
  const [ loading, setLoading ] = useState(false);

  const toast = useRef(null);

  // Завантаження даних
  const loadData = async() => {
    setLoading(true);   
    try {
      const response = await getRecommended(toast);
      if (response) {
        setBooks(response);
      }
    } 
    finally {
      setLoading(false); // знімаємо ознаку після завершення завантаження
    }
  }

  // При зміні користувача викликаємо функцію завантаження даних
  useEffect(() => {
    if ((!user || !user.userId) && localStorage.getItem('jwtToken') !== "") {
      localStorage.removeItem("jwtToken");
      document.cookie = `refresh-token=; Max-Age=-1; Path=/; `;     
      if (window.location.pathname.startsWith("/recommended"))  
        navigate('/');
    }
    else {
      loadData();
    }
  }, [user?.userId])

  // Оновлення даних після редагування книги
  const hadleChange = (editedBook) => {
    const temp = [...books];
    const editedIndex = temp.findIndex(b => b.bookId === editedBook.bookId);
    if (editedIndex !== -1) {
      temp[editedIndex] = {...books[editedIndex], ...editedBook};
      setBooks(temp);
    }
  }

  // Заголовок
  const header = () => (
    <div className="flex justify-content-between align-items-center gap-3 mb-2">
      <h2>Рекомендовані книги</h2>
    </div>
  );  
   
  // Шаблон відображення списку DataView
  const listTemplate = () => (
    <div className="grid grid-gutter">
      {books.map((book, index) => 
        <div className="col-12 md:col-6 xl:col-4 2-xl:col-3" key={index} >
          <BookCard bookCard={book} isReadOnly={true} toastRef={toast} onChange={hadleChange}/>
        </div>             
      )}
    </div>
  );  

  // --------------------------------------------------------------------------------------------
  return (
    <>
      <Toast ref={toast} /> 
      <div className="card">   
        <DataView header={header()} 
          dataKey="bookId" loading={loading}
          value={books} emptyMessage={<span className='text-primary font-bold'>Рекомендації відсутні. Недостатньо інформації</span>} 
          listTemplate={listTemplate}/>
      </div>
    </>

  )
}