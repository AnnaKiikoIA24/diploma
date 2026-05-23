import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Card, Button, Rating, InputTextarea, Toast } from 'primereact';
import { useForm, Controller } from 'react-hook-form';
import './Comment.css'
import { ratingNew, ratingEdit } from "../../utils/ratings";

CommentForm.propTypes = {
  closeForm: PropTypes.func,
  comment: PropTypes.object,
  onNewComment: PropTypes.func,
  onEditComment: PropTypes.func,
};

export default function CommentForm({ closeForm, comment, onNewComment, onEditComment }) {
  const [defaultComment, setDefaultComment] = useState(comment);
  const toast = useRef(null);
  
  const {
    control,
    handleSubmit,
    reset,
    formState: {
      errors,
      isDirty,
      isValid,
    },
  } = useForm({
    mode: 'onChange',
    defaultValues: defaultComment
  });

  const applyChanges = async(data) => {

    if (data?.ratingId === null) {
      const newRating = await ratingNew(data, toast);
      // Якщо додавання пройшло успішно
      if (newRating) {
        // Записуємо нові default-дані
        setDefaultComment(newRating.rating);
        onNewComment(newRating);
        closeForm();
      }
    }
    else {
      const editedRating = await ratingEdit(data, toast);
      // Якщо зміна даних пройшла успішно
      if (editedRating) {
        onEditComment(editedRating)
        // Закриваємо вікно форми
        closeForm();
      }
    }
  };

  const resetChanges = () => {
    reset(defaultComment); 
  }

  const getFormErrorMessage = (name) => (
    errors[name] && <small className="p-error">{errors[name].message}</small>
  );
  
  const footer = (
    <div className="field flex justify-content-center gap-4 my-0 py-0">
      {/* Зберегти зміни */}
      <Button icon="pi pi-save" disabled={!isDirty || !isValid} type="submit" 
        label="Зберегти" className="m-0 text-sm w-8rem" 
        rounded severity="success" />

      {/* Скасувати */}
      <Button icon="pi pi-undo" disabled={!isDirty} type="reset" 
        label="Скасувати" className="m-0 text-sm w-8rem" 
        outlined rounded />   
    </div>              
  )

  return (
    <form className="p-fluid"
    onSubmit={handleSubmit(applyChanges)} onReset={resetChanges} 
    >
      <Toast ref={toast} /> 
      <Card footer = {footer} className='comment-card'>
        <div className='flex flex-column justify-content-start gap-2'>
          <div className="flex flex-row gap-3 align-items-center">
            <Controller name="grade" control={control}
              rules={{ required: "Додайте рейтинг" }}
              render={({ field }) => (
              <>
                <div>
                  <Rating cancel={false} id={field.name} {...field} 
                    onChange={(e) => field.onChange(e.target.value)} />
                </div>             
              </>
            )} />
            {getFormErrorMessage('grade')}
          </div> 

          <div className="field">
            <Controller name="review" control={control} 
              render={({ field }) => (                
                <InputTextarea autoResize id={field.name} {...field} 
                  className='w-full text-sm'
                  placeholder="Введіть текст коментаря"
                  onChange={(e) => field.onChange(e.target.value)}
                  rows={5} cols={30} />
            )} />

          </div>
        </div>
      </Card>
    </form>
  );
}