/**
 * CONFIGURACIÓN DEL FRONT END
 * -------------------------------------------------------------
 * API_URL: pegue aquí la URL de la implementación de la Web App
 * de Google Apps Script (termina en /exec).
 * Si se deja vacía, la aplicación funciona en MODO DEMOSTRACIÓN
 * (datos locales del navegador, usuario: demo / clave: demo123).
 */
window.FINAV_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxl6mHj4zN0VS3fJS40KVeAozwFUYq3IXHBsceEbBbl6jc8-pIsnpLv8jpVLaCnBkPk/exec',
  EMPRESA: 'Maíz & Yuca',
  SUBTITULO: 'Cafetería',
  TIMEZONE: 'America/Guayaquil',
  TZ_OFFSET: '-05:00',             // Ecuador no tiene horario de verano
  SEGUNDOS_INACTIVIDAD: 90,      // vuelve al login si el usuario no actúa
  SEGUNDOS_AUTOCIERRE_MENSAJE: 30 // cierra el mensaje de confirmación si nadie presiona Aceptar
};
