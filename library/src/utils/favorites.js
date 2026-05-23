import { notify } from "../components/notify/notify";
import api from "./api";

// Додавання книги до переліку книг користувача
const favoritesAdd = async(bookId, toastRef) => {

  return await api.post(`/favorites/${bookId}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера favoritesAdd:", result);
      notify.success(toastRef, "", 'Книга успішно додана до списку "Мої книжки"');       
      return result;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 

    switch (error.status) {
      case 404:
        errorMsg = `POST-метод favorites відсутній!`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка при додаванні книги до переліку книг користувача:", errorMsg);
    notify.error(toastRef, "Помилка при додаванні книги до переліку книг користувача", errorMsg);  
    return null;
  })
}

// Додавання книги до переліку книг користувача
const favoritesDel = async(bookId, toastRef) => {

  return await api.delete(`/favorites/${bookId}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера favoritesDel:", result);
      notify.success(toastRef, "", 'Книга успішно видалена зі списку "Мої книжки"');       
      return result;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 

    switch (error.status) {
      case 404:
        errorMsg = `DELETE-метод favorites відсутній!`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка при видаленні книги з переліку книг користувача:", errorMsg);
    notify.error(toastRef, "Помилка при видаленні книги з переліку книг користувача", errorMsg);  
    return null;
  })
}

export { favoritesAdd, favoritesDel }