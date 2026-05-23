import { useEffect, useState, useContext } from 'react';
import { Panel, DataView, Button, Dialog } from 'primereact';
import PropTypes from 'prop-types';
import CommentCard from './CommentCard';
import CommentForm from './CommentForm';
import { getRatings } from '../../utils/ratings';
import { AppContext } from "../context/AppContext";

CommentList.propTypes = {
  bookId: PropTypes.string,
  toastRef: PropTypes.object,
  onChangeRating: PropTypes.func,
}

export default function CommentList({bookId, toastRef, onChangeRating}) {
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [visibleDialogForm, setVisibleDialogForm] = useState(false);
  const { user } = useContext(AppContext);
  const newComment = {
    "ratingId": null,
    "userId": user.userId,
    "bookId": bookId,
    "grade": null,
    "review": "",
    "createdAt": null,
    "isEdit": false
  }
  useEffect(() => { 
    const loadData = async() => {
      setLoading(true); 
      try {

        const response = await getRatings(bookId, toastRef);
        if (response) {
          setComments(response);
        }
      } 
      finally {
        setLoading(false); // знімаємо ознаку після завершення завантаження
      }
    }  

    loadData();
    
  }, [bookId])

  // Обробка додавання нового коментаря
  const handleNewComment = (comment) => {
    // Додавання нового коментаря в колекцію comments
    const commentInfo = {...comment.rating, "owner": true, "userName": user.firstName + " " + user.lastName};
    const temp = [...comments];
    temp.unshift(commentInfo);
    setComments(temp);

    // Виклик методу оновлення загального рейтингу книги 
    onChangeRating(comment.ratingBook);
  }

  // Обробка редагування коментаря
  const handleEditComment = (comment) => {
    const temp = [...comments];
    temp[0] = {...temp[0], ...comment.rating}; //коментар поточного користувача завжди перший елемент списку
    setComments(temp);

    // Виклик методу оновлення загального рейтингу книги 
    onChangeRating(comment.ratingBook);
  }

  // Обробка видалення коментаря
  const handleDeleteComment = (ratingBook) => {
    const temp = [...comments];
    temp.shift()
    setComments(temp);

    // Виклик методу оновлення загального рейтингу книги 
    onChangeRating(ratingBook);
  }

  const header = (
    <div className='flex flex-row gap-5 align-items-center'>
      <i className='pi pi-comments'/> Коментарі читачів ({comments.length} комент.)
      {/* Новий коментар  */}
      {(comments.length === 0 || comments[0].owner !== true) &&
        <Button label="Додати мій коментар та оцінку " tooltip="Додати мій коментар" text rounded icon="pi pi-file-plus" 
          size="small" severity="warning" onClick={() => setVisibleDialogForm(true)}/>    
      }
    </div>);

  // Шаблон відображення списку DataView
  const listTemplate = () => (
    <div className="flex flex-column">
      {comments.map((comment, index) => 
        <div key={index} >
          <CommentCard comment={comment} toastRef={toastRef} 
          onEditComment={handleEditComment} onDeleteComment={handleDeleteComment} 
          />
        </div>             
      )}
    </div>
  );  

  return (<>
    <Panel className='no-border-panel mt-3' header={header} >
      <DataView loading={loading}
        value={comments} listTemplate={listTemplate}
        emptyMessage={<span className='text-primary font-bold'>Коментарі відсутні. Залиште свій коментар та оцінку....</span>} 
        alwaysShowPaginator={false}
        layout="list"
      />
    </Panel>

    <Dialog header={
      <h5 className='my-0 py-0'>
        <i className='pi pi-comment' style={{ fontSize: '1rem', marginRight: '4px' }}/> Новий коментар
      </h5>}
      visible={visibleDialogForm} maximizable={false} closable={true} className="md:w-8 lg:w-5 p-0" 
      onHide={() => setVisibleDialogForm(false)} >

      <CommentForm closeForm={() => setVisibleDialogForm(false)} comment={newComment} onNewComment={handleNewComment}/>
    </Dialog>    
    </>
  );
}