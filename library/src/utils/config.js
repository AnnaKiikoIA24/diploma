const apiUrl = import.meta.env.VITE_ApiUrl || ''
const APP_GOOGLE_CLIENT_ID = import.meta.env.VITE_APP_GOOGLE_CLIENT_ID || ''
let _config;

// Завантаження конфігурації
export const load = async () => {
  // if (import.meta.env.MODE != 'development') {
  //   return null;
  // }
  // else {
    _config = {
      apiUrl: apiUrl,
      appGoogleClientId: APP_GOOGLE_CLIENT_ID
    // }
  }
}

// Отримання завантаженої конфігурації
export const getConfig = () => _config