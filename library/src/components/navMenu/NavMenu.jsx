import { useEffect, useContext, useRef } from 'react'
import { Menubar, Avatar, Badge, Toast } from 'primereact';
import {useNavigate} from "react-router-dom";

import logoImg from "../../assets/logo.png";
import { AppContext } from '../context/AppContext';
import ColorTheme from './ColorTheme';
import UserData from './UserData';
import './NavMenu.css';
import { getCatalogs } from '../../utils/catalog';

export default function NavMenu ()  {
  const navigate = useNavigate();  
  const toast = useRef(null);
  const { user, catalogs, setCatalogs } = useContext(AppContext);
  
  useEffect(() => {
    const asyncLoad = async() => {
      const loadedData = await getCatalogs();
      // Запис до контексту
      setCatalogs(loadedData);
    }
    
    if (!catalogs) 
      asyncLoad();
      
  }, []);

  const start = 
    <div className="flex align-items-center justify-content-center gap-2">
      <Avatar size="large" image={logoImg} shape="circle" />
      <span className='text-cyan-500 font-bold text-xl mr-5 hide-on-mobile'>
        Електронна<br/>бібліотека
      </span>
    </div>;
  
  const itemRenderer = (item) => (
    <a className="flex align-items-center p-menuitem-link">
      <span className={item.icon} />
      <span className="mx-2" >{item.label} {item.badge && <font className="text-sm text-primary font-bold"> ({item.badge})</font>} </span>
      {/* {item.badge && <Badge className="ml-auto" severity="secondary" value={item.badge} />}  */}
    </a>
  );

  let items = [];

  items.push({
    label: 'Всі книги',
    icon: 'pi pi-book',
    //badge: user.favoritesCnt,
    template: itemRenderer,
    command: () => { navigate('/allBooks') }
  })  
  if (user?.favoritesCnt > 0) {
    items.push({
      label: 'Мої книги',
      icon: 'pi pi-heart-fill',
      badge: user.favoritesCnt,
      template: itemRenderer,
      command: () => { navigate('/myBooks') }
    })
  }
  if (user?.userId) {
    items.push({
      label: 'Рекомендації',
      icon: 'pi pi-thumbs-up',
      template: itemRenderer,
      command: () => { navigate('/recommended') }
    })
  }

  if (user?.role) {
    items.push({
      label: 'Статистика',
      icon: 'pi pi-chart-line',
      template: itemRenderer,
      command: () => { navigate('/statistic') }
    })
  }  
  const end = (
    <div className="flex align-items-center gap-2" >
      <UserData />
      <ColorTheme />
    </div>);

  return (
    <>
      <Toast ref={toast} />     
      <Menubar model={items} start={start} end={end} className="shadow-4 w-full top-0 left-0 z-5 border-none " />
    </>
  )  
}