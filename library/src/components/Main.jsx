import { useEffect, useState, useContext, useRef } from 'react';
import {useNavigate} from "react-router-dom";
import PropTypes from 'prop-types';
import { Sidebar  } from 'primereact';
import BookList from "./books/BookList";
import FilterForm from './filters/FilterForm';
import { AppContext } from './context/AppContext';

Main.propTypes = {
  isMyBooksOnly: PropTypes.bool 
}

export default function Main({isMyBooksOnly = false}) {
  const [visibleFilters, setVisibleFilters] = useState(false);  
  const navigate = useNavigate();  
  const { user, setFilters } = useContext(AppContext);
  const prevUserId = useRef(user?.userId);

  // Обнулення фільтрів при зміні користувача
  useEffect(() => { 
    if (prevUserId.current !== user?.userId) {
      prevUserId.current = user?.userId;
      setFilters(null);
    }
    if ((!user || !user.userId) && localStorage.getItem('jwtToken') !== "") {
      localStorage.removeItem("jwtToken");
      document.cookie = `refresh-token=; Max-Age=-1; Path=/; `;     
      if (window.location.pathname.startsWith("/myBooks"))  
        navigate('/');
    }
  }, [user?.userId])
  
  return (
    <>
      <BookList 
        setVisibleFilters={() => setVisibleFilters(true)} 
        isMyBooksOnly={isMyBooksOnly}/>

      <Sidebar visible={visibleFilters} position="top" onHide={() => setVisibleFilters(false)} className="h-auto">
        <FilterForm closeForm={() => setVisibleFilters(false)} />
      </Sidebar> 
    </>      
  )
}