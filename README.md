# FINAV · Sistema de Control de Personal y Procesos — v1.0

Cliente: **Maíz & Yuca Cafetería** · Desarrollado por **FINAV Financial Advisor**

| Capa | Tecnología |
|---|---|
| Front end | HTML + CSS + JavaScript (sin dependencias) — publicado en **GitHub Pages** |
| Backend / API | **Google Apps Script** (Web App) |
| Base de datos | **Google Sheets** (`1mq0Xf80u8T9gR-IfWXit3m6ValfblSEBVT9UDJ1pgp8`) |

```
finav-rrhh/
├── index.html              ← aplicación web
├── css/styles.css
├── js/config.js            ← AQUÍ se pega la URL de la API
├── js/app.js
├── assets/                 ← logos FINAV y Maíz & Yuca
└── apps-script/
    ├── Code.gs             ← backend (se pega en Apps Script)
    └── appsscript.json     ← manifiesto (zona horaria Ecuador)
```

---

## 1. Instalar el backend en Google Sheets (≈10 min)

> Hágalo con la cuenta **patmantbot@gmail.com** (propietaria del Sheet).

1. Abra el Sheet → menú **Extensiones › Apps Script**.
2. Borre el contenido de `Código.gs` y pegue todo el archivo `apps-script/Code.gs`.
3. Engranaje **⚙️ Configuración del proyecto** → active *“Mostrar el archivo de manifiesto appsscript.json”*. Abra `appsscript.json` y reemplácelo con el de esta carpeta.
4. Guarde (💾). En la barra superior seleccione la función **`setup`** y pulse **▶ Ejecutar**. Autorice los permisos (*Configuración avanzada › Ir a … (no seguro)* es normal en scripts propios).
   - Se crean las hojas **Usuarios, Registros, Bitacora, Config**, los formatos y las protecciones.
   - Se crea el usuario inicial **`admin` / `Finav2026*`** — cámbielo luego.
5. **Implementar › Nueva implementación** → tipo **Aplicación web**:
   - *Ejecutar como:* **Yo (patmantbot@gmail.com)**
   - *Quién tiene acceso:* **Cualquier usuario**
   - Pulse **Implementar** y copie la URL que termina en **`/exec`**.

> Cada vez que modifique `Code.gs` use **Implementar › Gestionar implementaciones › ✏️ › Versión: Nueva** para conservar la misma URL.

## 2. Publicar el front end en GitHub (≈5 min)

1. Edite `js/config.js` y pegue la URL: `API_URL: 'https://script.google.com/macros/s/XXXX/exec'`
2. Cree un repositorio en GitHub (p. ej. `control-personal`) y suba **todo el contenido** de esta carpeta (puede arrastrar los archivos en *Add file › Upload files*).
3. Repositorio › **Settings › Pages** → *Source:* **Deploy from a branch** → *Branch:* `main` / `/(root)` → **Save**.
4. En 1–2 minutos la app estará en `https://<su-usuario>.github.io/control-personal/`.

> Sin URL configurada la app funciona en **modo demostración** (`demo` / `demo123`) con datos locales del navegador, útil para capacitación.

## 3. Administración de usuarios

Al abrir el Sheet aparece el menú **⚙️ FINAV RRHH** (solo el administrador puede usarlo):

| Opción | Uso |
|---|---|
| Crear usuario | Asistente paso a paso (usuario, nombre, cédula, cargo, área, rol, contraseña) |
| Restablecer contraseña | Asigna una nueva y desbloquea el usuario |
| Activar / Inactivar usuario | Un usuario inactivo no puede marcar |
| Cifrar contraseñas temporales | **Carga masiva:** llene filas en *Usuarios* con la contraseña en la columna *Password Temporal*; esta opción la cifra y borra el texto plano |
| Cerrar jornadas vencidas | Marca como `INCOMPLETA` las jornadas sin salida > 18 h |
| Reaplicar protecciones | Restablece la seguridad si alguien cambió permisos |

*Opcional:* Apps Script › ⏰ **Activadores** › Agregar → función `cerrarJornadasVencidas`, *Basado en tiempo*, diario 03:00–04:00.

## 4. Reglas de negocio implementadas

**Una fila por jornada:** todos los eventos se escriben en la misma fila de *Registros* creada por el **Ingreso** (incluso si la salida ocurre después de medianoche).

**Secuencia lógica obligatoria** (validada en el servidor, no solo en pantalla):

| Estado actual | Eventos permitidos |
|---|---|
| Sin jornada | Ingreso a turno |
| En turno | Salida a almuerzo (1 por jornada) · Salida con permiso (máx. 2) · Salida de turno |
| En almuerzo | Retorno de almuerzo |
| En permiso | Retorno de permiso |
| Finalizada | — (siguiente evento: nuevo Ingreso) |

- El permiso temporal exige **motivo** (Cita médica, Trámite personal, Diligencia de la empresa, Calamidad doméstica u Otro con detalle).
- Se calculan automáticamente **minutos de almuerzo, minutos de permiso y horas trabajadas netas**.
- Mensaje al registrar: **“Evento XXX — Hora: hh:mm:ss; Fecha: dd/mm/aaaa”** + botón **Aceptar**, que regresa al ingreso del siguiente usuario (cierre automático a los 30 s si nadie lo pulsa).

## 5. Seguridad

- **Hora del servidor:** la fecha/hora se toma de Google (zona `America/Guayaquil`), no del equipo — no se puede adelantar el reloj para marcar.
- **Contraseñas** con hash SHA‑256 + salt único; columnas de hash ocultas. Nunca viajan ni se guardan en texto plano.
- **Bloqueo** tras 5 intentos fallidos por 15 min.
- **Token de un solo uso:** cada autenticación permite registrar un único evento y expira a los 3 min.
- **Inmutabilidad:** el sistema nunca sobrescribe una celda ya registrada.
- **Hojas protegidas:** solo **patmantbot@gmail.com** puede editar. Los empleados no tienen acceso al Sheet; escriben únicamente a través de la API.
- **Bitácora:** todo intento (exitoso o rechazado) queda en *Bitacora* con fecha, hora, usuario, evento y resultado.
- **No comparta el Sheet** con permisos de edición; si necesita que alguien lo consulte, compártalo como **Lector**.

Parámetros ajustables en la hoja **Config** (horas de jornada abierta, intentos, minutos de bloqueo, etc.).

## 6. Próximas entregas (pestañas visibles “en mantenimiento”)

Apertura de Local · Cierre de Caja · Inventario · Reportes.
