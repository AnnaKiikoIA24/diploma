import { notify } from "../components/notify/notify";
import api from "./api";

// Читання книги
const getReadingBook = async(fileName, toastRef) => {
  return await api.get(`/reading?fileName=${fileName}`,
    { responseType: 'blob' })
    .then((response) => {
      if (response.status !== 200) {
        console.error("Помилка завантаження файлу:", response.status);
        notify.error(toastRef, "Помилка завантаження файлу:", response.status);   
        return null;       
      }
      // обробка відповіді від серверу
      const blob = response.data;
      const objectUrl = URL.createObjectURL(blob);          
      const ct = response.headers['content-type'] || undefined;
      const contentType = ct || blob.type || "";

      return { objectUrl, contentType };
  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 

    switch (error.status) {
      case 401:
        errorMsg = `Не вдалося перевірити облікові дані`;
        break;      
      case 404:
        errorMsg = `Файл ${fileName} відсутній на сервері!`;
        break;
      case 600:
        errorMsg = `Помилка запису до БД!`;
        break;        
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }

    console.error("Помилка завантаження файлу:", errorMsg);
    notify.error(toastRef, "Помилка завантаження файлу", errorMsg);  
    return null;
  })
}

// Старт читання книги користувачем: 
// повертає дату початку читання, якщо до цього не читав
const startReading = async(bookId, toastRef) => {
  return await api.post(`/reading/start/${bookId}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера startReading:", result);    
      return result;
  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 

    switch (error.status) {
      case 404:
        errorMsg = `POST-метод reading/start відсутній!`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка при додаванні інформації в БД про початок читання книги:", errorMsg);
    notify.error(toastRef, "Помилка при додаванні інформації в БД про початок читання книги", errorMsg);  
    return null;
  })  
}

// Додавання / зняття ознаки прочитаного: 
// isRead = 1 -> помітити прочитаним; isRead =0 -> зняти ознаку прочитаного
const markReadUnread = async(bookId, isRead, toastRef) => {

  return await api.post(`/reading/${bookId}/${isRead}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера markReadUnread:", result);
      notify.success(toastRef, "", isRead ===1 ? 'Книга помічена прочитаною' : 'У книги знята ознака прочитаної');     
      return result;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 

    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    console.error(`Помилка при ${isRead === 1 ? "додаванні" : "вилученні"} ознаки прочитаної книги :`, errorMsg);
    notify.error(toastRef, `Помилка при ${isRead === 1 ? "додаванні" : "вилученні"} ознаки прочитаної книги`, errorMsg);  
    return -1;
  })
}

export { getReadingBook, startReading, markReadUnread }