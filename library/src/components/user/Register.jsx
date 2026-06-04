import { useState, useContext, useRef } from "react";
import { useForm, Controller } from 'react-hook-form';
import PropTypes from 'prop-types';
import { InputText, Button, Toast } from 'primereact';
import { Password } from 'primereact/password';
import { AppContext } from "../context/AppContext";
import { classNames } from 'primereact/utils';
import { editUser, registerUser } from "../../utils/user";

Register.propTypes = {
  onVisible: PropTypes.func,
  toastRef: PropTypes.object
};

export default function Register ({onVisible, toastRef}) {
  const { user, setUser } = useContext(AppContext);
  const toast = useRef(null);

  const defaultValues = { ...user, password: "", confirmPassword: "", oldPassword: "" }   
  
  const { 
    control, 
    handleSubmit, 
    reset,
    // setValue,
    getValues,
    formState: { 
      errors, 
      isDirty, 
      isValid, 
      //isSubmitSuccessful
    },
    clearErrors
  } = useForm({ mode: 'onChange', defaultValues});  
 
  const [confirmedPassword, setConfirmedPassword] = useState(true);  

  const getFormErrorMessage = (name) => (
    errors[name] && <small className="p-error">{errors[name].message}</small>
  );

  const onInputValueChange = (e, field) => {    
    field.onChange(e.target.value);
    setConfirmedPassword(getValues("password") === getValues("confirmPassword"));
  }

  const applyChanges = async(data) => {
    let newUser = null;
    if (user?.userId) 
      newUser = await editUser(data, toast, toastRef);
    else 
      newUser = await registerUser(data, toast);
    
    // Якщо реєстрація/зміна даних пройшли успішно
    if (newUser) {
      // В AppContext змінили поточного користувача
      setUser(newUser);
      onVisible(false);
    }
  }

  // Повертаємо default дані 
  const resetChanges = () => {
    reset({ ...user, password: "", confirmPassword: "", oldPassword: "" } ); 
    setConfirmedPassword(true);    
  }  
 
  return (
  <>
    <Toast ref={toast} />    
    <form className="p-fluid" onSubmit={handleSubmit(applyChanges)} onReset={resetChanges} >
      <div className="card formgrid grid">

        {/* Логін */}
        <div className="field col-12 md:col-6">
          <label htmlFor="username" className={classNames({ 'p-error': errors.username })}>Електронна пошта*: </label>
          <Controller name="username" control={control} 
            rules={{ 
              required: "Введіть логін користувача", 
              maxLength: { value: 25, message: "Довжина логіну не більше 25 символів" },
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

        {/* Старий пароль */}
        <div className="field col-12 md:col-6">
          {user?.userId && 
          <>
          <label htmlFor="oldPassword" className={classNames({ 'p-error': errors.oldPassword })}>Старий пароль*: </label>
          <Controller name="oldPassword" control={control} 
            rules={{ 
              required: "Введіть старий пароль",
              minLength: { value: 4, message: "Довжина паролю не менше 4 символів" }             
            }}
            render={({ field, fieldState }) => (                   
              <Password  id={field.name} {...field} 
                className={ classNames([{ 'p-invalid': fieldState.invalid }, "w-full"])}
                onChange={(e) => onInputValueChange(e, field)} 
                onFocus={() => clearErrors(field.name)} />          
          )} />
          {getFormErrorMessage('oldPassword')}
          </>}         
        </div>         
        
        {/* Пароль */}
        <div className="field col-12 md:col-6">
          <label htmlFor="password" className={classNames({ 'p-error': errors.password })}>
            {user?.userId ? "Новий пароль" : "Пароль"}*: 
          </label>
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

        {/* Підтвердження паролю */}
        <div className="field col-12 md:col-6">
          <label htmlFor="confirmPassword">Підтвердження паролю*: </label>
          <Controller name="confirmPassword" control={control} 
            rules={{ validate: (value) => (value === getValues('password')) }}
            render={({ field, fieldState }) => (                   
              <Password  id={field.name} {...field} 
                className={ classNames([{ 'p-invalid': fieldState.invalid }, "w-full"])}
                onChange={(e) => onInputValueChange(e, field)} 
                promptLabel="Введіть пароль" 
                weakLabel="Дуже простий" 
                mediumLabel="Середньої складності" 
                strongLabel="Високої складності"
              />           
          )} />
          {getFormErrorMessage('confirmPassword')}         
        </div> 
        
        <div className="field col-12 flex align-items-center justify-content-center">
          <font className="text-sm p-error" hidden={confirmedPassword}>
            {user?.userId ? "Новий пароль" : "Пароль"} не підтверджений!
          </font>
        </div>

        {/* Ім'я */}
        <div className="field col-12 md:col-6">
          <label htmlFor="firstName" className={classNames({ 'p-error': errors.firstName })}>Ім'я*: </label>
          <Controller name="firstName" control={control} 
            rules={{ required: "Введіть ім'я користувача" }}
            render={({ field, fieldState }) => (                   
              <InputText id={field.name} {...field} 
                keyfilter={/^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ'\s]+$/}
                className={ classNames([{ 'p-invalid': fieldState.invalid }, "w-full"])}
                onChange={(e) => onInputValueChange(e, field)}
                onFocus={() => clearErrors(field.name)}  />          
          )} />
          {getFormErrorMessage('firstName')}         
        </div> 

        {/* Прізвище */}
        <div className="field col-12 md:col-6">
          <label htmlFor="lastName" className={classNames({ 'p-error': errors.lastName })}>Прізвище: </label>
          <Controller name="lastName" control={control} 
            render={({ field, fieldState }) => (                   
              <InputText id={field.name} {...field} 
                keyfilter={/^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ'\s]+$/}
                className={ classNames([{ 'p-invalid': fieldState.invalid }, "w-full"])}
                onChange={(e) => onInputValueChange(e, field)}
                onFocus={() => clearErrors(field.name)}  />          
          )} />
          {getFormErrorMessage('lastName')}         
       </div> 

        <div className="field flex align-items-center col-12 text-secondary text-sm">
          <label>* - обов'язкове для заповнення</label> 
        </div>

        <div className="field col-12 md:col-6 flex justify-content-center align-items-center md:justify-content-end ">
          <Button icon={user?.userId ? "pi pi-user-edit" : "pi pi-user-plus"} disabled={!isDirty || !isValid} type="submit" 
          label={user?.userId ? "Зберегти зміни" : "Зареєструватись"} className="m-0 text-sm w-12rem" 
          rounded severity="success" />
        </div>
        <div className="field col-12 md:col-6 flex justify-content-center align-items-center md:justify-content-start">
          <Button icon="pi pi-undo" disabled={!isDirty} type="reset" 
          label="Скасувати зміни" className="m-0 text-sm w-12rem" 
          outlined rounded />
        </div> 
                                
      </div>             
    </form>
  </>
  )
}