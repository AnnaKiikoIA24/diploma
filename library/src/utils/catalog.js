import { notify } from "../components/notify/notify";
import api from "./api";

const getCatalogs = async (toastRef) => {
  return await api.get(`/catalogs`)
    .then((response) => {
      const result = response.data;
      console.log("Каталоги отримано:", result);

      return result; 
    })
    .catch((error) => {
      let errorMsg = "";
      const status = error.response?.status; // HTTP-статус
      const detail = error.response?.data?.detail; 
      errorMsg = status ? "statusCode=" + error.status + ".\n" + detail : error;  
      console.error("Помилка при отриманні каталогів:", errorMsg);
      notify.error(toastRef, "Помилка отримання каталогів", errorMsg);

      return null;
    });
};

export { getCatalogs }