import { notify } from "../components/notify/notify";
import api from "./api";

// Рекомендації до книги при натисканні на неї
const getRecommendedByBook = async(bookId, toastRef) => {

  return await api.get(`/recommended/${bookId}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера getRecommendedByBook:", result);
      return result;

  })
  .catch(error => {   
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;     
    console.error("Помилка при отриманні рекомендацій на основі обраної книги", errorMsg);
    notify.error(toastRef, "Помилка при отриманні рекомендацій на основі обраної книги", errorMsg);  
    
    return null;
  })
}

// Загальні рекомендації для користувача
const getRecommended = async(toastRef) => {

  return await api.get(`/recommended`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера getRecommended:", result);
      return result;

  })
  .catch(error => {   
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;     
    console.error("Помилка при отриманні рекомендацій", errorMsg);
    notify.error(toastRef, "Помилка при отриманні рекомендацій", errorMsg);  
    
    return null;
  })
}

export { getRecommendedByBook, getRecommended }