import { useContext, useState, useRef } from 'react';
import {useNavigate} from "react-router-dom";
import { SplitButton, Button, Dialog, Toast } from 'primereact';
import { AppContext } from '../context/AppContext';
import Register from '../user/Register';
import Login from '../user/Login';
import './NavMenu.css';

export default function UserData() {
  const { user, setUser } = useContext(AppContext);
  const navigate = useNavigate();  
  const toast = useRef(null);
  const [registerFormVisible, setRegisterFormVisible] = useState(false);
  const [loginFormVisible, setLoginFormVisible] = useState(false);

  const itemsUserInfo = [
  {
    label: 'Вихід',
    icon: 'pi pi-sign-out',
    command: () => signOut()
  }]; 

  if (user?.externalAccount === false) {
    itemsUserInfo.unshift({
      label: 'Редагувати',
      icon: 'pi pi-user-edit',
      command: () => setRegisterFormVisible(true)
    })
  }

  const registerHeader = (
    <h5 className='text-cyan-700'>
      {user?.userId ? "Редагування облікового запису" : "Реєстрація користувача"}
    </h5>);  

  const loginHeader = (
    <h5 className='text-cyan-700'>
      Вхід в систему
    </h5>);

  // Вихід із системи
  const signOut = () => {
    setUser({ 
      userId: null,
      username: "",
      oldPassword: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      role: false,
      externalAccount: false
    });
    localStorage.removeItem("jwtToken");
    document.cookie = `refresh-token=; Max-Age=-1; Path=/; `;
    navigate('/');
  }

  return (
    <>
      <Toast ref={toast} />    
      {(!user || !user.userId) &&
        <> 
          <Button label="Зареєструватись" tooltip="Реєстрація" tooltipOptions={{ position: 'bottom' }} 
            className="hide-label" icon="pi pi-user-plus" severity="info"  rounded raised size="small"
            onClick={() => setRegisterFormVisible(true)} /> 

          <Button label="Увійти" tooltip="Вхід" tooltipOptions={{ position: 'bottom' }} 
            className="hide-label" icon="pi pi-user" severity="info" rounded raised size="small"
            onClick={() => setLoginFormVisible(true)}/> 
        </>}
      {user?.userId && <>
        <span className="font-italic text-sm text-primary hidden md:inline-block">{user?.username} {user?.role && " адміністратор"}</span>
        <SplitButton label={`${user.firstName} ${user.lastName ?? ""}`} model={itemsUserInfo} 
          icon={user.externalAccount === true ? "pi pi-google" : "pi pi-user"} 
          severity="info" rounded raised size="small"/>
      </>}
      
      {/* Форма реєстраційних даних користувача */}
      <Dialog header={registerHeader}
        visible={registerFormVisible} maximizable={false} closable={true} className="md:w-10 lg:w-6 p-0" 
        onHide={() => setRegisterFormVisible(false)}>
        
        <Register onVisible={setRegisterFormVisible} toastRef={toast}/>
      </Dialog>  

      {/* Форма логіна */}
      <Dialog header={loginHeader}
        visible={loginFormVisible} maximizable={false} closable={true} className="md:w-5 lg:w-3  p-0" 
        onHide={() => setLoginFormVisible(false)}>
        
        <Login onVisible={setLoginFormVisible} onRegister={setRegisterFormVisible}/>
      </Dialog>     

    </>
  )
}