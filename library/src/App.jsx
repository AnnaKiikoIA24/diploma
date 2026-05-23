import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Router from './Router.jsx';
import { locale, addLocale, PrimeReactProvider } from "primereact/api";
import './App.css'
import {AppContextProvider} from './components/context/AppContextProvider'
import NavMenu from './components/navMenu/NavMenu.jsx'
import { load, getConfig } from './utils/config.js'

function App() {
  // Додаємо та активуємо local ua 
  // для confirmPoup
  addLocale("ua", {
    accept: "Так",
    reject: "Нi"
  });
  locale("ua");

  const [appConfig, setAppConfig] = useState(null);

  // Завантаження конфігурації
  useEffect(() => {
    const asyncLoad = async() => {
      await load();
      const config = getConfig();
      setAppConfig(config);
      console.log("config=", JSON.stringify(config))
    }
    asyncLoad();
    
  }, []);

  return (
    <BrowserRouter>
      <PrimeReactProvider>
        <GoogleOAuthProvider clientId={appConfig?.appGoogleClientId ?? ""}>
          <AppContextProvider>
            <header>
              <NavMenu/>
            </header>
            <main>
              <Router />
            </main>
          </AppContextProvider>
        </GoogleOAuthProvider>
      </PrimeReactProvider>
    </BrowserRouter>
  )
}

export default App
