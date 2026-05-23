import { notify } from "../components/notify/notify";
import api from "./api";

// Метод отримання даних статистики (аналітичної інформації для адміна)
const getStatistic = async(toastRef) => {

  return await api.get(`/statistic`)
    .then((response) => {

      // обробка відповіді від серверу
      const result = response.data;
      console.log("Відповідь сервера getStatistic:", result);
      return result;

  })
  .catch(error => {   
    let errorMsg = "";
    const status = error.response?.status; // HTTP-статус
    const detail = error.response?.data?.detail; 
    errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;     
    console.error("Помилка при отриманні даних статистики", errorMsg);
    notify.error(toastRef, "Помилка при отриманні даних статистики", errorMsg);  
    
    return null;
  })
}

export { getStatistic }