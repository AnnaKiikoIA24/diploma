export function formattedUa(isoString) {
  // створюємо об'єкт Date
  const date = new Date(isoString);

  // отримуємо компоненти
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0'); // місяці з 0
  const yyyy = date.getFullYear();

  const hh   = String(date.getHours()).padStart(2, '0');
  const mi   = String(date.getMinutes()).padStart(2, '0');
  const ss   = String(date.getSeconds()).padStart(2, '0');

  // формуємо рядок
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}:${ss}`;  
}