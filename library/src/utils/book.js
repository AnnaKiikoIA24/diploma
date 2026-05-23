import { notify } from "../components/notify/notify";
import api from "./api";

// Метод переіндексації книг в контейнері meilisearch
const reindexBooks = async(toastRef) => {

  return await api.post(`/meilisearch/index-books`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера reindexBooks:", result);
      notify.success(toastRef, "", `Індекси в пошуковій системі Meilisearch успішно оновлені: загалом ${result.indexed} книг(и).`);
      return result;

  })
  .catch(error => {   
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;     
    console.error("Помилка при переіндексації книг в контейнері пошуку", errorMsg);
    notify.error(toastRef, "Помилка при переіндексації книг в контейнері пошуку", errorMsg);  
    
    return null;
  })
}

// Метод переіндексації книг в контейнері meilisearch
const searchNameBook = async(searchStr, toastRef) => {

  return await api.get(`/meilisearch/search?searchStr=${encodeURIComponent(searchStr)}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера reindexBooks:", result);
      return result.map(book => book.book_name);

  })
  .catch(error => {   
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;     
    console.error("Помилка при отриманні даних пошуку назви книги з пошукового контейнеру", errorMsg);
    notify.error(toastRef, "Помилка отриманні даних пошуку назви книги з пошукового контейнеру", errorMsg);  
    
    return null;
  })
}

// Перелік книг (задана порцiя)
const getBooks = async(limit, offset, filters, isMyBooksOnly, toastRef) => {

  if (filters)
    // Якщо фільтри задані
    return await api.post(`/filters/books?limit=${limit}&offset=${offset}&isMyBooksOnly=${isMyBooksOnly}`, filters)
      .then((response) => {

        // обробка відповіді від серверу
        const result = response.data;
        console.log("Відповідь сервера getBooks (з фыльтрацією)::", result);
        return result;

    })
    .catch(error => {
      let errorMsg = "";
      const status = error.response?.status; // HTTP-статус
      const detail = error.response?.data?.detail; 

      switch (error.status) {
        case 404:
          errorMsg = `POST-метод filters/books відсутній!`;
          break;
        default:        
          errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
      }

      console.error("Помилка при отриманні переліку книг:", errorMsg);
      notify.error(toastRef, "Помилка при отриманні переліку книг", errorMsg);  
      return null;
    })
  else
    // Якщо фільтри НЕ задані
    return await api.get(`/books?limit=${limit}&offset=${offset}&isMyBooksOnly=${isMyBooksOnly}`)
      .then((response) => {

        // обробка відповіді від серверу
        const result = response.data;
        console.log("Відповідь сервера getBooks (без фільтрів):", result);
        return result;

    })
    .catch(error => {
      let errorMsg = "";
      const status = error.response?.status; // HTTP-статус
      const detail = error.response?.data?.detail; 

      switch (error.status) {
        case 404:
          errorMsg = `GET-метод books відсутній!`;
          break;
        default:        
          errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
      }

      console.error("Помилка при отриманні переліку книг:", errorMsg);
      notify.error(toastRef, "Помилка при отриманні переліку книг", errorMsg);  
      return null;
    })
}

// Iнформацiя про книгу
const getBook = async(bookId, toastRef) => {

  return await api.get(`/books/${bookId}`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера getBook:", result);
      return result;

  })
  .catch(error => {   
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;     
    console.error("Помилка при отриманні iнформацiї про книгу", errorMsg);
    notify.error(toastRef, "Помилка при отриманні iнформацiї про книгу", errorMsg);  
    
    return null;
  })
}

// Створення нової книги
const bookNew = async(bookData, toastRef) => {

  return await api.post(`/books`, bookData)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера bookNew:", result);
      notify.success(toastRef, "", "Нова книга успішно збережена");       
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
        errorMsg = `POST-метод books відсутній!`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка при додаванні нової книги:", errorMsg);
    notify.error(toastRef, "Помилка при додаванні нової книги", errorMsg);  
    return null;
  })
}

// Редагування iснуючої книги
const bookEdit = async(bookData, toastRef) => {

  return await api.put(`/books`, bookData)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера bookEdit:", result);    
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
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка редагування книги:", errorMsg);
    notify.error(toastRef, "Помилка редагування книги", errorMsg);  
    return null;
  })
}

// Видалення iснуючої книги
const bookDelete = async(bookId, toastRef) => {

  return await api.delete(`/books/${bookId}`)
    .then(() => {
      notify.success(toastRef, "", "Книга успішно видалена");       
      return true;

  })
  .catch(error => {
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 

    switch (error.status) {
      case 401:
        errorMsg = `Не вдалося перевірити облікові дані користувача`;
        break;
      default:        
        errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;
    }    
    console.error("Помилка видалення книги:", errorMsg);
    notify.error(toastRef, "Помилка видалення книги", errorMsg);  
    return false;
  })
}

export { reindexBooks, searchNameBook, getBooks, getBook, bookNew, bookEdit, bookDelete }