import { useState, useContext, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { AppContext } from "../context/AppContext";
import { Button, Chip, OverlayPanel, Dialog, Tag } from 'primereact';
import Rating from 'react-rating';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import './Book.css'
import emptyBookImg from "../../assets/empty_book.jpg";
import BookForm from "./BookForm";
import BookReader from "../bookReader/BookReader";
import { favoritesAdd, favoritesDel } from "../../utils/favorites";
import { markReadUnread } from "../../utils/reading";

BookForm.propTypes = {
  bookCard: PropTypes.object,
  isShortFormat: PropTypes.bool,
  isReadOnly: PropTypes.bool,
  isDetailsFormat: PropTypes.bool,
  toastRef: PropTypes.object,
  onChange: PropTypes.func,
  onDelete: PropTypes.func
};

export default function BookCard({bookCard, isShortFormat, isReadOnly, isDetailsFormat, toastRef, onChange, onDelete}) {
  const { catalogs, user, setFavoritesCnt } = useContext(AppContext);
  const navigate = useNavigate(); 

  const overlayPanel = useRef(null);
  const language = catalogs?.languages.find(l => l.id === bookCard.languageId);
  // Ознака видимостi дiалогу коригування книги
  const [visibleDialogForm, setVisibleDialogForm] = useState(false);
  // Ознака видимості компоненту для читання змісту книги
  const [visibleDialogContent, setVisibleDialogContent] = useState(false);

  const handleUpdateBook = (editedBook) => {
    onChange(editedBook)
  }

  // Обране користувача: додати / видалити
  const handleFavorites = async(e) => {
    e.stopPropagation(); // зупиняє спливання
    if (bookCard.isFavorite === false) {
      const result = await favoritesAdd(bookCard.bookId, toastRef);
      // Якщо додавання пройшло успішно
      if (result) {
        // Оновити дані по книзі
        onChange({...bookCard, isFavorite: true });
        setFavoritesCnt(user.favoritesCnt + 1);
      }
    }
    else {
      const result = await favoritesDel(bookCard.bookId, toastRef);
      // Якщо видалення пройшло успішно
      if (result) {
        // Оновити дані по книзі
        onChange({...bookCard, isFavorite: false });
        setFavoritesCnt(user.favoritesCnt- 1);
      }      
    }
  }

  // Ознака прочитаної книги: додати / видалити
  const handleMarkReadUnRead = async (e) => {
    e.stopPropagation(); // зупиняє спливання
    const result = await markReadUnread(bookCard.bookId, bookCard.dateFinishRead === null ? 1 : 0, toastRef);
    // Якщо додавання зняття ознаки прочитаного пройшло успішно
    if (result !== -1) {
      // Оновити дані по книзі
      onChange({...bookCard, dateFinishRead: result });
    }    
  }

  // Перейти на детальну інформацію по книзі
  const showBookDetails = () => {
    if (user?.userId)
      navigate('/book/details', { 
          state: { bookCard } 
        })
  }
  
  // Запит на видалення книги
  const confirmDelete = (event) => {
    confirmPopup({
      target: event.currentTarget,
      message: 
      <>
        Увага! При натисненні кнопки книга буде видалена.
        <br />Ви підтверджуєте операцію?
        <hr />
      </>,
      icon: 'pi pi-exclamation-triangle',
      defaultFocus: 'reject',
      accept: () => onDelete(event, bookCard),
      reject: () => {}
    })
  };

  // --------------------------------------------------------------------------------------------  
  return (
    <> 
      <div className={`grid border-100 border-round-lg shadow-1 mr-1 mb-1 pb-2 div-card overflow-hidden ${!isShortFormat ? "md:h-15rem" : ""}`}>
        <div className={`col-12 md:col-${(isShortFormat ? 12 : (user?.userId || isDetailsFormat) ? 7 : 8)}`}
         onClick={showBookDetails}>
          <div className="flex flex-column align-items-center gap-3">
            {/* Назва книги */}
            <div className="text-md font-bold">
              {bookCard.bookName}  
              {!bookCard.source && 
              <Tag className="text-xs ml-3 h-2" 
                value={<i className="pi pi-eye-slash" style={{ fontSize: '0.7rem' }}/>} 
                severity="danger"/>}
            </div>
            {/* Автори */}
            <div className="text-sm font-semibold">
              {bookCard.authors.map((authorId, index) => {
                  const author = catalogs?.authors.find(a => a.id === authorId)
                  return author?.name && <>{(index !== 0 ? <br/> : <></>)}{author?.name}</>
                }) 
              }
            </div>        
            {/* Рік видання */}   
            {!isShortFormat &&    
            <div className="text-sm">
              Рік&nbsp;видання: <span className="font-bold"> {bookCard.bookYear}</span>     
            </div>}
            {/* Мова */}
            <div className="text-sm">
              Мова:&nbsp;   
              <span style={{ backgroundColor: 'var(--primary-color)' }} className="text-white font-bold p-1 mr-1 text-xs">
                {language?.code}
              </span> 
              <span className="font-bold">{language?.name}</span>
            </div>
            {/* Жанри */}
            {/* {!isShortFormat && */}
            <div>
              {bookCard.genres.map(genreId => {
                  const genre = catalogs?.genres.find(g => g.id === genreId)
                  return genre?.name && <Chip key={genreId} label={genre?.name} className="text-xs font-semibold mr-2"/>
                }) 
              }
            </div>
            {/* } */}
            {/* Рейтинг */}
            {!isShortFormat &&
            <div className="text-sm">
              <div style={{ display: "flex", gap: "10px" }}>
              {/* <Rating value={bookCard.rating} readOnly cancel={false}></Rating>    */}
              <Rating 
                initialRating={bookCard.rating}
                readonly
                fractions={2}
                emptySymbol="pi pi-star" 
                fullSymbol="pi pi-star-fill" style={{ color:  'var(--primary-color)' }}
              />    
              </div>                                             
            </div>}              
          </div>
        </div>
        
        <div className={`col-12 ${!isShortFormat ? "md:col-4" : ""}`} onClick={showBookDetails}>
          <div className="flex flex-column align-items-center gap-2">
            {/* Обкладинка */}
            <img className="max-w-9rem h-11rem border-round-md" 
              src={bookCard.bookCover ? bookCard.bookCover : emptyBookImg} 
              alt="Фото відсутнє" />

            <div className="card flex justify-content-center">   
              {/* Анотація */}
              {bookCard.annotation && !isDetailsFormat && !isShortFormat &&
                <>
                <Button type="button" label="Анотація" icon="pi pi-align-justify" rounded text size="small" severity="info"
                  onClick={(e) => { e.stopPropagation(); overlayPanel.current.toggle(e)}} />

                <OverlayPanel ref={overlayPanel} showCloseIcon={false}>
                  <div className="text-xs max-w-25rem overflow-x-auto font-italic text-color-secondary">
                    {bookCard.annotation}
                  </div>
                </OverlayPanel>
                </>
              }                           
              {isDetailsFormat && bookCard.source && user?.userId &&
              <> 
              {/* Читати */}
              <Button type="button" icon="pi pi-file-pdf" className="text-xs h-2rem"
                label={bookCard.dateFinishRead ? <>Читати&nbsp;знову</> : (bookCard.dateStartRead ? "Читаю..." : "Читати")} 
                rounded  raised  
                onClick={(e) => { e.stopPropagation(); setVisibleDialogContent(true)}} />   
              </>}

            </div>
          </div>              
        </div>  
        
        {user?.userId && (!isShortFormat || isDetailsFormat) &&   
        <div className="col-12 md:col-1">
          <div className="flex flex-row md:flex-column justify-content-center align-items-center">  
            {/* Назад до переліку книг */}
            {isDetailsFormat &&          
            <Button type="button" icon="pi pi-arrow-left" rounded  text size="small" severity="info"
                tooltip="Назад до переліку книг" tooltipOptions={{ position: 'bottom' }}
                onClick={(e) => { e.stopPropagation(); navigate(-1); }} />
            }   

            {user?.userId &&
            <>
            {/* Закладки (обране) */}
            <Button icon={`pi pi-heart${(bookCard.isFavorite === true ? "-fill" : "")}`} text rounded size="small" severity="info"
              tooltip={(bookCard.isFavorite === true ? "Видалити зі списку моїх книг" : "Додати до списку моїх книг")}
              tooltipOptions={{ position: 'bottom' }}
              onClick={handleFavorites} />

            {/* Ознака прочитаного */}
            {(bookCard.dateFinishRead || bookCard.dateStartRead) &&
            <Button type="button" icon={`pi pi-flag${(bookCard.dateFinishRead ? "-fill" : "")}`} 
              className="h-2rem w-2rem"
              tooltip={bookCard.dateFinishRead ? "Помітити непрочитаним" : "Помітити прочитаним"} 
              tooltipOptions={{ position: 'bottom' }} rounded outlined
              severity={bookCard.dateFinishRead ? "success" : "info"}
              onClick={handleMarkReadUnRead} />               
            }
            
            </>} 

            {user?.role === true && !isReadOnly &&
            <>
              {/* Редагувати книгу */}
              <Button icon="pi pi-pen-to-square" text rounded severity="warning" size="small"
                tooltip="Редагувати книгу" tooltipOptions={{ position: 'bottom' }}
                onClick={() => setVisibleDialogForm(true) }/>
              {/* Видалити книгу */}
              <Button icon="pi pi-delete-left" text rounded severity="danger" size="small"
                tooltip="Видалити книгу" tooltipOptions={{ position: 'bottom' }}
                onClick={confirmDelete} />
              <ConfirmPopup />                              
            </>
            } 
          </div>    
        </div>
        } 
      </div>
      

      {/* Дiалог редагування книги */}
      {!isReadOnly &&
      <Dialog header={
        <h5 className='my-0 py-0'>
          <i className='pi pi-pen-to-square' style={{ fontSize: '1rem', marginRight: '4px' }}/> Редагування книги
        </h5>}
        visible={visibleDialogForm} maximizable={false} closable={true} className="md:w-8 lg:w-7 p-0" 
        onHide={() => setVisibleDialogForm(false)} >

        <BookForm bookId={bookCard.bookId} closeForm={() => setVisibleDialogForm(false)}
          updateData={handleUpdateBook} />
      </Dialog>}    

      {/* Дiалог читання книги */}
      <Dialog header={
        <h5 className='my-0 py-0'>
          <i className='pi pi-file-pdf' style={{ fontSize: '1rem', marginRight: '4px' }}/> {bookCard.bookName} читання...
        </h5>}
        visible={visibleDialogContent} maximized maximizable closable
        onHide={() => setVisibleDialogContent(false)} >       
          <BookReader bookId={bookCard.bookId} dateStartRead={bookCard.dateStartRead} fileName={bookCard.source} 
            toastRef={toastRef} 
            updateData={handleUpdateBook} onClose={() => setVisibleDialogContent(false)}/>
      </Dialog> 
                      
    </>

  
  )
}