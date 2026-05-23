import { useState, useMemo } from 'react';
import { AppContext } from "./AppContext";

export const AppContextProvider = ({ children }) => {
  // кольорова тема
  const [colorTheme, setColorTheme] = useState(localStorage.getItem("colorTheme") ?? 'mira'); 
  // користувач
  const [user, setUser] = useState({ 
    userId: null,
    username: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    role: false,
    // ознака зовнішнього аккаунта (Google тощо)
    externalAccount: false,
    // кількість книг користувача (обране)
    favoritesCnt: 0 });

  // const toggleTheme = () => {
  //   setValue(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  // };

  // довідкова інформація 
  const [catalogs, setCatalogs] = useState(null);
  const setFavoritesCnt = (cnt) => setUser({...user, favoritesCnt: cnt})
  // зміщення при виборі переліку книги (номер сторінки * кількість книг на сторінці)
  const [first, setFirst] = useState(0);
  // параметри фільтрації
  const [filters, setFilters] = useState(null);

  const value = useMemo(() => ({
    user, colorTheme,  catalogs, first, filters
  }), [user, colorTheme, catalogs, first, filters]);

  return (
    <AppContext.Provider value={{
      ...value, setUser, setFavoritesCnt, setColorTheme, setCatalogs,setFirst, setFilters }}>
      {children}
    </AppContext.Provider>
  );
};