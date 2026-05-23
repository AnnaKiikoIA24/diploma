import { useEffect, useState } from 'react';
import { Panel } from 'primereact';
import PropTypes from 'prop-types';
import BookCard from '../books/BookCard';
import { getRecommendedByBook} from '../../utils/recommended';

RecommendedByBook.propTypes = {
  bookId: PropTypes.string,
  toastRef: PropTypes.object,
}

export default function RecommendedByBook({bookId, toastRef}) {
  const [recommBooks, setRecommBooks] = useState([]);

  useEffect(() => { 
    const loadData = async() => {
      const response = await getRecommendedByBook(bookId, toastRef);
      if (response) {
        setRecommBooks(response);
      }
    }  

    loadData();
    
  }, [bookId])  

  return (
    <Panel className='no-border-panel mt-3' header={<><i className='pi pi-thumbs-up'/> Рекомендації</>}>
      <div className='grid no-gutter'>
        {recommBooks.map(book => 
          <div className='col-12 lg:col-6'>
            <BookCard bookCard={book} isReadOnly isShortFormat/>
          </div>)}
      </div>
    </Panel>
  );
}