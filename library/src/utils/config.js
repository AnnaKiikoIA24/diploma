//const environment = import.meta.env.VITE_ENVIRONMENT || ''
const apiUrl = import.meta.env.VITE_ApiUrl || ''
const APP_GOOGLE_CLIENT_ID = import.meta.env.VITE_APP_GOOGLE_CLIENT_ID || ''
let _config;

// Завантаження конфігурації
export const load = async () => {
  if (import.meta.env.MODE != 'development') {
    // return await axios.get('/config')
    //   .then(response => {
    //     if (response.status === 200) {
    //       _config = response.data;
    //       loadDbInfo(_config.apiUrl);
    //     }
    //   })
    return null;
  }
  else {
    _config = {
      apiUrl: apiUrl,
      appGoogleClientId: APP_GOOGLE_CLIENT_ID
    }
  }
}

// Отримання завантаженої конфігурації
export const getConfig = () => _config