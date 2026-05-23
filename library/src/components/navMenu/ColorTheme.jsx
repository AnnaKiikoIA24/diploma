import { useContext, useState, useEffect } from 'react';
import { SplitButton } from 'primereact';
import { PrimeReactContext } from 'primereact/api';
import { AppContext } from '../context/AppContext';


export default function ColorTheme() {
  const { colorTheme, setColorTheme } = useContext(AppContext);
  // Тема за замовчуванням при завант. додатку (визначається в файлі index.html <link relation..../>), значення defaultTheme має відповідати index.html
  // Це значення при завантаж. елемента використовує функція changeTheme (1-й аргумент - акуальна тема, 2-й аргумент - нова тема)
  const [defaultTheme ] = useState('mira');
  const [newTheme, setNewTheme] = useState('');
  const { changeTheme } = useContext(PrimeReactContext);	
	const themes = [
		{
			label: 'Класична (classic)',
			icon: colorTheme === 'mira' ? 'pi pi-check' : '',
			command: () => setNewTheme('mira')
		},
		{
			label: 'Бурштин (amber)',
			icon: colorTheme === 'lara-light-amber' ? 'pi pi-check' : '',
			command: () => setNewTheme('lara-light-amber')
		},
		{
			label: 'Блакить (cyan)',
			icon: colorTheme === 'lara-light-cyan' ? 'pi pi-check' : '',
			command: () => setNewTheme('lara-light-cyan')   
	}]; 	

  // Ефект при завантаж. елемента
  useEffect(() => { 
    // Змінимо default-тему на ту, що збережена користувачем в налашт. браузера (остання обрана)
    if (colorTheme !== '')
      changeTheme?.(defaultTheme, colorTheme, 'theme-link-app', () => {});

  }, []);  

  // Ефект при зміні кольорової теми
  useEffect(() => {
    if (newTheme === "" || newTheme === colorTheme)
      return;

    console.log("colorTheme=", colorTheme, "newTheme=", newTheme);
    changeTheme?.(colorTheme, newTheme, 'theme-link-app', 
      () => {
        setColorTheme(newTheme); 
        localStorage.setItem("colorTheme", newTheme); 
      });

  }, [newTheme, setColorTheme, colorTheme, changeTheme]);

	return (
		<SplitButton tooltip="Палітра" tooltipOptions={{ position: 'bottom' }} model={themes} 
      icon="pi pi-palette" size="small" rounded raised outlined />
	)
}