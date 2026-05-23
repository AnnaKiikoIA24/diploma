import { notify } from "../components/notify/notify";
import api from "./api";

// Вхід в систему за логіном/паролем
const loginUser = async(userData, toastRef) => {
  const formData = new URLSearchParams();
        formData.append("username", userData.username);
        formData.append("password", userData.password);

  return await api.post(`/auth/login`, formData, 
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )
    .then((response) => {
      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера:", result);

    if (result.token) {
      // Зберігаємо токен в localStorage
      localStorage.setItem("jwtToken", JSON.stringify(result.token));
      console.log("JWT токен збережено!");
    }
    return result.user;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail;     
    switch (error.status) {
      case 401:
        errorMsg = `Неправильне ім'я користувача або пароль!`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }     
    console.error("Помилка при вході в систему:", errorMsg);
    notify.error(toastRef, "Помилка при вході в систему", errorMsg);  
    return null;
  })
}

// Вхід через Google Account
const googleUser = async(credentialResponse, toastRef) => {

  return await api.post(`/auth/google`, { credential: credentialResponse.credential })
    .then((response) => {
      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера:", result);
      if (result.token) {
        // Зберігаємо токен в localStorage, бо ім'я користувача могло змінитись
        localStorage.setItem("jwtToken", JSON.stringify(result.token));
        console.log("JWT токен збережено!");
      }      

      return result.user;

    })
    .catch(error => {
      let errorMsg = "";
      const status = error.response?.status; // HTTP-статус
      const detail = error.response?.data?.detail;       
      switch (error.status) {     
        case 401:
          errorMsg = `Помилка ідентифікації Google account!`;
          break;
        case 409:
          errorMsg = `Зареєстрований локальний обліковий запис з таким логіном!`;
          break;          
        default:        
          errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
      }
      console.error("Помилка зміни облікових даних:", errorMsg);
      notify.error(toastRef, "Помилка зміни облікових даних", errorMsg);  
      return null;
    })
}

// Реєстрація користувача
const registerUser = async(userData, toastRef) => {

  return await api.post(`/users`, userData)
    .then((response) => {
      // if (response.status !== 200) {
      //   switch (response.status) {
      //   case 409:
      //     throw new Error(`Користувач з логіном ${userData.username} вже існує!`);
      //   case 404:
      //     throw new Error(`POST-метод users відсутній!`);
      //   default:
      //     throw new Error(`Невідома помилка: statusCode=${response.status}!`);
      //   }
      // }

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера:", result);

    if (result.token) {
      // Зберігаємо токен в localStorage
      localStorage.setItem("jwtToken", JSON.stringify(result.token));
      console.log("JWT токен збережено!");
    }
    return result.user;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail;     
    switch (error.status) {
      case 409:
        errorMsg = `Користувач з логіном ${userData.username} вже існує!`;
        break;
      case 404:
        errorMsg = `POST-метод users відсутній!`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка при реєстрації:", errorMsg);
    notify.error(toastRef, "Помилка при реєстрації", errorMsg);  
    return null;
  })
}

// Редагування користувача
const editUser = async(userData, toastRefErr, toastRefMess) => {

  return await api.put(`/users`, userData)
    .then((response) => {
      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера:", result);
      if (result.token) {
        // Зберігаємо токен в localStorage, бо ім'я користувача могло змінитись
        localStorage.setItem("jwtToken", JSON.stringify(result.token));
        console.log("JWT токен збережено!");
      }      
      notify.success(toastRefMess, "", "Зміни успішно збережені"); 
      return result.user;

    })
    .catch(error => {
      let errorMsg = "";
      const status = error.response?.status; // HTTP-статус
      const detail = error.response?.data?.detail;       
      switch (error.status) {
        case 409:
          errorMsg = `З логіном ${userData.username} вже існує інший користувач!`;
          break;
        case 412:
          errorMsg = `Cтарий пароль не підтверджений!`;
          break;          
        case 404:
          errorMsg = `Користувач з userId=${userData.userId} не знайдений!`;
          break;
        default:        
          errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
      }
      console.error("Помилка зміни облікових даних:", errorMsg);
      notify.error(toastRefErr, "Помилка зміни облікових даних", errorMsg);  
      return null;
    })
}

// Оновлення токену
const refreshToken = async() => {

  return await api.post(`/auth/refresh`)
    .then((response) => {
      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера:", result);

    if (result.token) {
      // Зберігаємо оновлений access-токен в localStorage
      localStorage.setItem("jwtToken", JSON.stringify(result.token));
      console.log("Оновлений JWT access-токен збережено!");
    }
    return true;

  })
  .catch(error => {
    let errorMsg = "";
    switch (error.status) {
      case 401:
        errorMsg = `Invalid refresh token!`;
        break;
      default:        
        errorMsg = `Невідома помилка: ${error.status ? "statusCode=" + error.status : error}!`;
    }     
    console.error("Помилка при оновленні токену:", errorMsg);
    return false;
  })
}

export { loginUser, googleUser, registerUser, editUser, refreshToken }