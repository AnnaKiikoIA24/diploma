
import axios from 'axios';
import { getConfig } from './config'
//import { refreshToken } from './user';

const api = axios.create();

// Додавання базового url та headers авторизації
api.interceptors.request.use((axiosConfig) => {
  const config = getConfig();
  axiosConfig.baseURL = config.apiUrl;
  axiosConfig.withCredentials = true;
  try {
    const jwtToken = JSON.parse(localStorage.getItem('jwtToken'));
    if (jwtToken) 
      axiosConfig.headers.Authorization = `Bearer ${jwtToken.access_token}`;
  }
  catch
  {
    console.error("Не вдалось прочитати jwtToken");
  }
  return axiosConfig;
});

// інтерцептор відповіді для 401 -> оновити токен / релогін
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    
     if (error.response?.status === 401 && localStorage.getItem("jwtToken") !== "") {
    //   const isRefresh = await refreshToken();
      //if (!isRefresh)
    }
    return Promise.reject(error);
  }
);

export default api;
