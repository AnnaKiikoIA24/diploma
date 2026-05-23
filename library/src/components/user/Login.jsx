import { useContext, useRef } from "react";
import { useForm, Controller } from 'react-hook-form';
import PropTypes from 'prop-types';
import { GoogleLogin } from '@react-oauth/google';
import { InputText, Button, Toast } from 'primereact';
import { Divider } from 'primereact/divider';
import { Password } from 'primereact/password';
import { AppContext } from "../context/AppContext";
import { classNames } from 'primereact/utils';
import { loginUser, googleUser } from "../../utils/user";
import { notify } from "../notify/notify";

Login.propTypes = {
  onVisible: PropTypes.func,
  onRegister: PropTypes.func
};

export default function Login ({onVisible, onRegister}) {
  const { user, setUser } = useContext(AppContext);
  const toast = useRef(null);

  const defaultValues = { ...user, password: "" }   
  
  const { 
    control, 
    handleSubmit, 
    reset,
    formState: { 
      errors, 
      isDirty, 
      isValid, 
    },
    clearErrors
  } = useForm({ mode: 'onChange', defaultValues});  
 

  // Записуємо оновлені default дані 
  const resetChanges = () => {
    reset({ ...user, password: "" }); 
  }   

  const getFormErrorMessage = (name) => (
    errors[name] && <small className="p-error">{errors[name].message}</small>
  );

  const onInputValueChange = (e, field) => {    
    field.onChange(e.target.value);
  }

  // Вхід в систему за логіном та паролем
  const applyChanges = async(data) => {
    const currentUser = await loginUser(data, toast);
    
    // Якщо вхід у систему пройшов успішно
    if (currentUser) {
      // В AppContext змінили поточного користувача
      setUser(currentUser);
      onVisible(false);
    }
  }
  
  // Вхід в систему за Google account
  const handleGoogleSuccess = async(credentialResponse) => {
    const currentUser = await googleUser(credentialResponse, toast);
    
    // Якщо вхід у систему пройшов успішно
    if (currentUser) {
      // В AppContext змінили поточного користувача
      setUser(currentUser);
      onVisible(false);
    }
  }
  
  // Реєстрація нового користувача
  const signUp = () => {
    onVisible(false);
    onRegister(true);
  }

  return (
  <>
    <Toast ref={toast} />  
    <div className="card">
      <div className="flex flex-column">
        <form className="p-fluid" onSubmit={handleSubmit(applyChanges)} onReset={resetChanges} >


          <div className="w-full flex flex-column">
            {/* Логін */}
            <div className="w-full flex flex-wrap gap-1 py-1">
              <label htmlFor="username" className={classNames({ 'p-error': errors.username })}>Електронна пошта: </label>
              <Controller name="username" control={control} 
                rules={{ 
                  required: "Введіть логін користувача", 
                  validate: (value) => {
                    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!re.test(value))
                      return "Логін не відповідає формату Email!";
                    return true;
                  }              
                }}
                render={({ field, fieldState }) => (                   
                  <InputText id={field.name} {...field} 
                    keyfilter="email" 
                    className={ classNames([{ 'p-invalid': fieldState.invalid }, "w-full"])}
                    onChange={(e) => onInputValueChange(e, field)}
                    onFocus={() => clearErrors(field.name)} />          
              )} />
              {getFormErrorMessage('username')}         
            </div> 

            {/* Пароль */}
            <div className="w-full flex flex-wrap gap-1 py-1">
              <label htmlFor="password" className={classNames({ 'p-error': errors.password })}>Пароль: </label>
              <Controller name="password" control={control} 
                rules={{ 
                  required: "Введіть пароль користувача",
                  minLength: { value: 4, message: "Довжина паролю не менше 4 символів" }             
                }}
                render={({ field, fieldState }) => (                   
                  <Password  id={field.name} {...field} 
                    className={ classNames([{ 'p-invalid': fieldState.invalid }, "w-full"])}
                    onChange={(e) => onInputValueChange(e, field)} 
                    promptLabel="Введіть пароль" 
                    weakLabel="Дуже простий" 
                    mediumLabel="Середньої складності" 
                    strongLabel="Високої складності"
                    onFocus={() => clearErrors(field.name)} />          
              )} />
              {getFormErrorMessage('password')}         
            </div> 

            <div className="field flex justify-content-center pt-2">
              <Button icon="pi pi-user" disabled={!isDirty || !isValid} type="submit" 
              label="Увійти" className="m-0 text-sm w-12rem" 
              rounded severity="success" />
            </div>
            <div className="field flex justify-content-center pb-2">
              <Button icon="pi pi-undo" disabled={!isDirty} type="reset" 
              label="Скасувати зміни" className="m-0 text-sm w-12rem" 
              outlined rounded />
            </div>                  
          </div> 
        </form> 
        
        <div className="w-full">
          <Divider layout="horizontal" className="flex" align="center">
              <b>АБО</b>
          </Divider>
        </div>
        <div className="field flex justify-content-center py-1">
          <GoogleLogin className="w-14rem" 
            onSuccess={handleGoogleSuccess} 
            onError={() => notify.error(toast, 'Помилка Google авторизації', 'Авторизація не пройдена') } />
        </div>   

        {/* <div className="w-full">
          <Divider layout="horizontal" className="flex" />
        </div>                */}
        <div className="w-full flex justify-content-center py-2">
          <Button label="Зареєструватись" icon="pi pi-user-plus" 
            severity="warning" className="w-14rem" 
            onClick={signUp} />
        </div>             
      </div>
    </div>           

  </>
  )
}