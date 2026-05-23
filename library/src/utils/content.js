import { notify } from "../components/notify/notify";
import api from "./api";

// Завантаження та збереження на сервері файлу зі змістом книги
const uploadFileContent = async(fileData, bookId, toastRef) => {

  return await api.post(`/content?bookId=${bookId}`, fileData, 
      { headers: { "Content-Type": "multipart/form-data" }})
    .then((response) => {
      if (response.status !== 200) {
        console.error("Помилка завантаження файлу:", response.status);
        notify.error(toastRef, "Помилка завантаження файлу:", response.status);    
        return null;      
      }      
      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера:", result);
      notify.success(toastRef, "Файл успішно завантажено на сервер!");

    return result;

  })
  .catch(error => {
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail;           
    const errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
     
    console.error("Помилка завантаження файлу:", errorMsg);
    notify.error(toastRef, "Помилка завантаження файлу", errorMsg);  
    return null;
  })
}

// Видалення на сервері файлу зі змістом книги
const deleteFileContent = async(fileName, bookId, toastRef) => {

  return await api.delete(`/content?fileName=${fileName}&bookId=${bookId}`)
    .then((response) => {
      if (response.status !== 200) {
        console.error("Помилка видалення файлу:", response.status);
        notify.error(toastRef, "Помилка видалення файлу:", response.status);    
        return null;      
      }      
      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера:", result);
      notify.success(toastRef, "Файл успішно видалено з сервера!");
    return result;

  })
  .catch(error => {
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail;           
    const errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
     
    console.error("Помилка видалення файлу:", errorMsg);
    notify.error(toastRef, "Помилка видалення файлу", errorMsg);  
    return null;
  })
}

export { uploadFileContent, deleteFileContent }
