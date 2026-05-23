import { useEffect, useState, useRef, useContext } from 'react';
import { DataView, Button, Paginator, Toast, Message, Dialog } from 'primereact';
import PropTypes from 'prop-types';
import { AppContext } from '../context/AppContext';
import BookCard from './BookCard';
import BookForm from './BookForm';
import { getBooks, bookDelete, reindexBooks } from '../../utils/book';
import './Book.css'
import meilisearchImg from "../../assets/meilisearch.jpeg";

BookList.propTypes = {
  setVisibleFilters: PropTypes.func,
  isMyBooksOnly: PropTypes.bool
};

export default function BookList({setVisibleFilters, isMyBooksOnly}) {
  const { user, setFavoritesCnt, first, setFirst, filters, setFilters } = useContext(AppContext);  
  // кількість рядків на сторінці
  const [rowsView] = useState(6);
  // масив книг
  const [ books, setBooks ] = useState([]);
  // загальна кількість книг (без пагінації)
  const [ totalRecords, setTotalRecords ] = useState(0);
  // ознака процеса завантаження даних
  const [ loading, setLoading ] = useState(false);
  // кеш сторінок в useRef
  const pagesCache = useRef({});
  // Ознака видимостi дiалогу додавання нової книги
  const [visibleDialogForm, setVisibleDialogForm] = useState(false);  

  const toast = useRef(null);

  // Завантаження даних
  const loadData = async(event) => {
    setLoading(true);   
    try {
      let offset = first, limit = rowsView;

      // Якщо це подія зміни номера стрінки в DataView
      if (event?.first !== undefined && event?.rows !== undefined) {
        offset = event.first;
        limit = event.rows;

        // Якщо дані відповідної сторінки є кеші
        if (pagesCache.current[offset]) {
          setFirst(offset); // оновлюємо стан пагінатора
          setBooks(pagesCache.current[offset]);
          setLoading(false);
          return;
        }
      }
          
      // Якщо немає в кеші — завантажуємо з сервера
      if (offset !== first)
        setFirst(offset); // оновлюємо стан пагінатора
      const response = await getBooks(limit, offset, filters, isMyBooksOnly, toast);
      if (response) {
        setBooks(response.items);
        setTotalRecords(response.totalRecords);
        setFavoritesCnt(response.totalUserRecords);
        // зберігаємо сторінку в кеш
        pagesCache.current[offset] = response.items; 
      }
    } 
    finally {
      setLoading(false); // знімаємо ознаку після завершення завантаження
    }
  }

  // Оновити дані 
  const refreshData = () => {
    pagesCache.current = {}; // очищення кеша
    loadData();
  }
  // Оновити індекси в Meilisearch
  const reindexData = async() => {
    await reindexBooks(toast);
  }

  // При зміні користувача або фільтрів викликаємо функцію оновлення даних
  useEffect(() => {
    refreshData();
  }, [user?.userId, filters, isMyBooksOnly])

  // Заголовок
  const header = () => (
    <div className="flex justify-content-between align-items-center gap-3 mb-2">
      
      {/* Кнопки */}
      <div className="flex gap-2">
        {/* Оновити */}
        <Button label="Оновити" tooltip="Оновити дані" rounded text icon="pi pi-sync" 
          size="small" className='hide-label h-3rem md:h-2rem max-w-3rem md:max-w-15rem text-sm' 
          severity="info" onClick={refreshData}/>
        {/* Фільтрація */}
        <Button label="Фільтрація" tooltip="Параметри пошуку" rounded icon={`pi pi-filter${filters ? "-fill" : ""}`} 
          size="small" className='hide-label h-3rem md:h-2rem max-w-3rem md:max-w-15rem text-sm' 
          raised={filters} text={!filters}
          onClick={setVisibleFilters}/>

        {filters &&
        <Button label="Скасувати фільтр" tooltip="Скасувати фільтрацію" rounded text icon='pi pi-filter-slash' 
          size="small" className='hide-label h-3rem md:h-2rem max-w-3rem md:max-w-15rem' 
          onClick={() => setFilters(null)}/>}

        {user?.role === true && !isMyBooksOnly && <>
        {/* Нова книга  */}
        <Button label="Нова книга" tooltip="Створити нову книгу" rounded text icon="pi pi-file-plus" 
          size="small" className='hide-label h-3rem md:h-2rem max-w-3rem md:max-w-15rem text-sm'
          severity="warning" onClick={() => setVisibleDialogForm(true)}/>

        {/* Переіндексувати  */}
        <Button label="" tooltip="Оновити індекс в Meilisearch" rounded text 
          size="small" className='hide-label h-3rem md:h-2rem max-w-3rem md:max-w-15rem text-sm'
          severity="danger" onClick={reindexData}>
          <img 
              src={meilisearchImg} 
              alt="Meilisearch" 
              style={{ width: '16px', height: '16px', marginRight: '8px' }} 
          />
          <span className='font-semibold hide-on-mobile'> Оновити Meilisearch</span>        
        </Button>
        </>}          
      </div>

      {isMyBooksOnly && 
      <h2>Мої книги</h2>}

      {/* Зовнішній пагінатор праворуч зверху */}
      <Paginator className="hidden md:block"
        first={first} rows={rowsView}
        totalRecords={totalRecords}
        onPageChange={loadData} />
    </div>
  );  

  // Підсумок
  const footer = () => (
    <div className="flex justify-content-end align-items-end mb-2">
    {/* Зовнішній пагинатор праворуч внизу */}
    <Paginator
      first={first} rows={rowsView}
      totalRecords={totalRecords}
      onPageChange={loadData} />
  </div>
  );    
  
  // Шаблон відображення списку DataView
  const listTemplate = () => (
    <div className="grid grid-gutter">
      {books.map((book, index) => 
        <div className="col-12 md:col-6 xl:col-4 2-xl:col-3" key={index} >
          <BookCard bookCard={book} isReadOnly={isMyBooksOnly} isDetailsFormat={false} 
            toastRef={toast} 
            onChange={hadleChange} onDelete={hadleDelete} />
        </div>             
      )}
    </div>
  );  

  // Оновлення даних після редагування книги
  const hadleChange = (editedBook) => {
    const temp = [...books];
    const editedIndex = temp.findIndex(b => b.bookId === editedBook.bookId);
    if (editedIndex !== -1) {
      temp[editedIndex] = {...books[editedIndex], ...editedBook};
      setBooks(temp);
      // змінюємо в кеші
      pagesCache.current[first] = temp;
    }
  }

  // Видалення книги
  const hadleDelete = async(e, deletedBook) => {
    e.stopPropagation();
    const isDeleted = await bookDelete(deletedBook.bookId, toast)
    // Якщо видалення пройшло вдало
    if (isDeleted === true) {
      // Отримуємо оновлений перелік книг поточної сторінки DataView (first - це зміщення)
      const response = await getBooks(rowsView, first, filters, isMyBooksOnly, toast);
      if (response) {
        setBooks(response.items);
        setTotalRecords(response.totalRecords);
        setFavoritesCnt(response.totalUserRecords);
        // зберігаємо сторінку в кеш
        pagesCache.current[first] = response.items; 
        // по всіх наступних сторінках чистимо кеш
        pagesCache.current = Object.fromEntries(
          Object.entries(pagesCache.current).filter(([key]) => key <= first)
        );
      }
    }
  }  
  // --------------------------------------------------------------------------------------------
  return (
    <>
      {!user || !user.userId &&
      <Message className='w-full mt-0 mb-0 font-italic' 
        text="Увага! Система працює з обмеженими можливостями. Для повного доступу необхідно авторизуватись." />}
      <Toast ref={toast} /> 

      <div className="card">   
        <DataView header={header()} footer={footer()} 
          dataKey="bookId" loading={loading}
          value={books} emptyMessage={<span className='text-primary font-bold'>Дані відсутні</span>} 
          alwaysShowPaginator={false}
          listTemplate={listTemplate}
          paginator={false} lazy  />
      </div>

      <Dialog header={
        <h5 className='my-0 py-0'>
          <i className='pi pi-file-plus' style={{ fontSize: '1rem', marginRight: '4px' }}/> Нова книга
        </h5>}
        visible={visibleDialogForm} maximizable={false} closable={true} className="md:w-8 lg:w-7 p-0" 
        onHide={() => setVisibleDialogForm(false)} >

        <BookForm closeForm={() => setVisibleDialogForm(false)} updateData={refreshData}/>
      </Dialog>

    </>

  )
}
