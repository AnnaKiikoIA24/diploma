import { useEffect, useState, useContext } from 'react';
import { Card, Button, Dialog, Rating } from 'primereact';
import PropTypes from 'prop-types';
import './Comment.css'
import { formattedUa } from '../../utils/formatDate';
import { ratingDelete } from '../../utils/ratings';
import CommentForm from './CommentForm';

CommentCard.propTypes = {
  comment: PropTypes.object,
  onEditComment: PropTypes.func,
  onDeleteComment: PropTypes.func,
  toastRef: PropTypes.object,
}

export default function CommentCard({ comment, onEditComment, onDeleteComment, toastRef }) {

  const [visibleDialogForm, setVisibleDialogForm] = useState(false);
  const handleDeleteComment = async() => {
    const result = await ratingDelete(comment.ratingId, comment.bookId, toastRef);
    if (result) 
      onDeleteComment(result.ratingBook);
  }

  const header = (
    <div className="flex align-items-center gap-4 pl-5">
      <small className="font-semibold" style={{ color: 'var(--primary-color)' }} >
        <i className='pi pi-slack'/> {comment.userName}
      </small>
      <Rating value={comment.grade} readOnly cancel={false} />   
      {comment.owner === true &&
        <div>
        {/* Редагувати коментар */}
        <Button icon="pi pi-pen-to-square" text rounded severity="warning" size="small"
          tooltip="Редагувати мій коментар" tooltipOptions={{ position: 'bottom' }}
          onClick={() => setVisibleDialogForm(true) }
        />
        {/* Видалити коментар */}
        <Button icon="pi pi-delete-left" text rounded severity="danger" size="small"
          tooltip="Видалити мій коментар" tooltipOptions={{ position: 'bottom' }}
          onClick={handleDeleteComment} 
        />          
        </div>}
    </div>
  );

  return (
    <>
    <Card header={header} className='comment-card'>
      <div className='flex flex-row justify-content-start gap-2'>
        <small className='flex flex-grow-1 text-left'>{comment.review}</small>
        {comment.isEdit === true &&
          <small className="flex flex-grow-0 text-xs font-italic" style={{ color: 'var(--red-400)' }} >
            відредаговано
          </small>        
        }
        <span className="text-xs text-gray-500 font-italic">{formattedUa(comment.createdAt)}</span>
      </div>
    </Card>

    <Dialog header={
      <h5 className='my-0 py-0'>
        <i className='pi pi-comment' style={{ fontSize: '1rem', marginRight: '4px' }}/> Редагувати коментар
      </h5>}
      visible={visibleDialogForm} maximizable={false} closable={true} className="md:w-6 lg:w-5 p-0" 
      onHide={() => setVisibleDialogForm(false)} >

      <CommentForm closeForm={() => setVisibleDialogForm(false)} comment={comment} onEditComment={onEditComment}/>
    </Dialog>
    </>
  );
}