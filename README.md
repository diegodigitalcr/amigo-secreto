# 🎁 Amigo Invisible Pro (Secret Santa)

Una aplicación web moderna, sencilla y elegante para organizar el juego del **Amigo Secreto / Amigo Invisible**, con notificaciones instantáneas a los participantes a través de **WhatsApp** o **Correo Electrónico**.

---

## 🌟 Características Principales

1. **Notificación Directa por WhatsApp (1-Click):**
   - Genera enlaces directos `wa.me/` listos para enviar a cada participante con un solo clic.
   - Mensaje personalizado con el nombre del participante, presupuesto, fecha, lugar e indicaciones.
   - Incluye botón para copiar el texto manualmente si se desea enviar por Telegram, SMS u otra app.

2. **Notificación por Correo Electrónico:**
   - **Opción Rápida:** Botón individual para abrir el cliente de correo predeterminado (`mailto:`).
   - **Opción Masiva Automática:** Envío masivo con 1 clic a todos los correos usando el servidor Node.js integrado con tu cuenta de **Gmail**, **Outlook** o cualquier servidor **SMTP**.

3. **Modo Tarjeta Mágica Sorpresa (Protección del Organizador):**
   - ¡El organizador no se arruina la sorpresa si también juega!
   - Cada participante recibe un enlace web único e interactivo (`/revelar.html#data=...`).
   - El participante toca una caja de regalo virtual animada para desempacarla con lluvia de confeti y descubrir a quién le tocó regalarle.

4. **Reglas de Exclusión Inteligentes:**
   - Evita que parejas se regalen entre sí o que se repitan emparejamientos del año anterior.
   - Algoritmo de desorden perfecto (*derangement*) que garantiza que nadie se saque a sí mismo y que todos den y reciban exactamente un regalo.

5. **Importación Rápida:**
   - Puedes pegar una lista completa copiada de Excel o texto (formato: `Nombre, Teléfono, Correo`).

6. **Sin pérdida de datos:**
   - Los datos se guardan automáticamente en el navegador (`LocalStorage`).

---

## 🚀 Cómo Iniciar la Aplicación

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
npm start
```

Luego abre tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📱 ¿Cómo funciona el envío por WhatsApp?

1. Al agregar cada participante, ingresa su número con el código de país (ejemplo: `+50688889999`, `+5215512345678`, `+34600112233`, etc.).
2. Realiza el sorteo.
3. Haz clic en el botón verde **📲 WhatsApp** de cada tarjeta.
4. Se abrirá WhatsApp (Web o App) con la conversación del participante y el mensaje ya redactado. ¡Solo debes darle enviar!

---

## ✉️ ¿Cómo configurar el envío automático de correos (Gmail)?

Si deseas usar el botón **"✉️ Enviar a todos por Correo"**:

1. En la aplicación, haz clic en **⚙️ Configurar Correo Automático**.
2. Si usas Gmail:
   - Ingresa tu correo de Gmail.
   - En contraseña, utiliza una **Contraseña de Aplicación** de Google (16 caracteres). Puedes generarla en [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) con verificación en 2 pasos activada.
3. Haz clic en **🔌 Probar Conexión** y luego en **Guardar Configuración**.
4. ¡Listo! Podrás enviar correos automáticos con un diseño festivo y profesional.

---

## 🛠️ Tecnologías

- **Backend:** Node.js, Express, Nodemailer, CORS.
- **Frontend:** HTML5, CSS3 moderno con Glassmorphism y Flexbox/Grid, JavaScript Vanilla ES6+, Canvas Confetti, Web Audio API.
