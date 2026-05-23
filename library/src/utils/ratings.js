import { notify } from "../components/notify/notify";
import api from "./api";

// Інформація про рейтинг по книзі
const getRatings = async(bookId, toastRef) => {

  return await api.get(`/ratings/${bookId}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера getRatings:", result);
      return result;

  })
  .catch(error => {   
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;     
    console.error("Помилка при отриманні даних коментарів та рейтингу книги", errorMsg);
    notify.error(toastRef, "Помилка при отриманні даних коментарів та рейтингу книги", errorMsg);  
    
    return null;
  })
}

// Створення нового коментаря
const ratingNew = async(ratingData, toastRef) => {

  return await api.post(`/ratings`, ratingData)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера ratingNew:", result);    
      return result;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 

    switch (error.status) {
      case 401:
        errorMsg = `Не вдалося перевірити облікові дані користувача`;
        break;
      case 404:
        errorMsg = `POST-метод ratings відсутній!`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка при додаванні нового коментаря:", errorMsg);
    notify.error(toastRef, "Помилка при додаванні нового коментаря", errorMsg);  
    return null;
  })
}

// Редагування коментаря
const ratingEdit = async(ratingData, toastRef) => {
    return await api.put(`/ratings`, ratingData)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера ratingEdit:", result);    
      return result;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    console.error("Помилка при редагуванні коментаря:", errorMsg);
    notify.error(toastRef, "Помилка при редагуванні коментаря", errorMsg);  
    return null;
  })
}

// Видалення коментаря
const ratingDelete = async(ratingId, bookId, toastRef) => {
    return await api.delete(`/ratings/${ratingId}/${bookId}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера ratingDelete:", result);    
      return result;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    console.error("Помилка при видаленні коментаря:", errorMsg);
    notify.error(toastRef, "Помилка при видаленні коментаря", errorMsg);  
    return null;
  })
}

export { getRatings, ratingNew, ratingEdit, ratingDelete }