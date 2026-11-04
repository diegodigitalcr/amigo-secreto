const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Estado de la API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    app: 'Amigo Invisible Pro',
    time: new Date().toISOString()
  });
});

// =============================================================================
// ALMACÉN DE SECRETOS AUTODESTRUCTIBLES
// =============================================================================
const secretsStore = new Map();
const DATA_DIR = path.join(__dirname, 'data');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');

// Cargar secretos existentes
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
if (fs.existsSync(SECRETS_FILE)) {
  try {
    const raw = fs.readFileSync(SECRETS_FILE, 'utf-8');
    const items = JSON.parse(raw);
    Object.entries(items).forEach(([k, v]) => secretsStore.set(k, v));
  } catch (e) {
    console.warn('No se pudieron leer secretos anteriores:', e.message);
  }
}

function persistSecrets() {
  try {
    const obj = Object.fromEntries(secretsStore);
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error persistiendo secretos:', e.message);
  }
}

// Guardar secretos para los participantes
app.post('/api/secrets', (req, res) => {
  const { secrets } = req.body;
  if (!secrets || !Array.isArray(secrets)) {
    return res.status(400).json({ error: 'Lista de secretos no válida' });
  }

  secrets.forEach(item => {
    if (item.token && item.data) {
      secretsStore.set(item.token, {
        data: item.data,
        burned: false,
        openedAt: null,
        createdAt: new Date().toISOString()
      });
    }
  });

  persistSecrets();
  res.json({ success: true, count: secrets.length });
});

// Obtener información del secreto (SIN QUEMAR en la consulta, para que bots, vistas previas de WhatsApp o recargas no lo quemen)
app.get('/api/secrets/:token', (req, res) => {
  const { token } = req.params;
  const item = secretsStore.get(token);

  if (!item) {
    return res.status(404).json({
      success: false,
      not_found: true,
      message: 'Esta tarjeta no existe o ya fue autodestruida.'
    });
  }

  if (item.burned) {
    return res.status(410).json({
      success: false,
      burned: true,
      to: item.data?.to || 'Participante',
      openedAt: item.openedAt,
      message: `Esta tarjeta ya fue abierta y se autodestruyó por seguridad.`
    });
  }

  // Se devuelven los datos SIN marcar como burned todavía
  res.json({
    success: true,
    data: item.data,
    burned: false
  });
});

// Endpoint explícito para quemar (autodestruir) el secreto cuando el usuario TOCA la caja de regalo
app.post('/api/secrets/:token/burn', (req, res) => {
  const { token } = req.params;
  const item = secretsStore.get(token);

  if (!item) {
    return res.status(404).json({ success: false, message: 'No encontrado' });
  }

  item.burned = true;
  item.openedAt = new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  persistSecrets();

  res.json({
    success: true,
    burned: true,
    openedAt: item.openedAt
  });
});

// Helper para crear transporter de Nodemailer
function createTransporter(smtpConfig) {
  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    throw new Error('Faltan credenciales de correo (usuario o contraseña).');
  }

  // Preconfiguración común para proveedores populares
  const service = smtpConfig.service ? smtpConfig.service.toLowerCase() : null;
  
  if (service === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpConfig.user.trim(),
        pass: smtpConfig.pass.trim() // Contraseña de aplicación de Gmail (16 letras)
      }
    });
  }

  if (service === 'outlook' || service === 'hotmail') {
    return nodemailer.createTransport({
      service: 'hotmail',
      auth: {
        user: smtpConfig.user.trim(),
        pass: smtpConfig.pass.trim()
      }
    });
  }

  // Configuración SMTP genérica (Host, Port, Secure)
  return nodemailer.createTransport({
    host: smtpConfig.host || 'smtp.gmail.com',
    port: parseInt(smtpConfig.port, 10) || 587,
    secure: smtpConfig.secure === true || smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user.trim(),
      pass: smtpConfig.pass.trim()
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Plantilla HTML para los correos
function buildEmailHtml({ name, secretFriend, eventName, budget, date, notes, revealLink }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu Amigo Secreto: ${eventName || 'Amigo Invisible'}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #1f2937;
      }
      .container {
        max-width: 600px;
        margin: 30px auto;
        background: #ffffff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0,0,0,0.06);
      }
      .header {
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
        color: #ffffff;
        padding: 36px 24px;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.5px;
      }
      .header p {
        margin: 8px 0 0;
        opacity: 0.9;
        font-size: 15px;
      }
      .badge {
        display: inline-block;
        background: rgba(255,255,255,0.2);
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 12px;
      }
      .content {
        padding: 32px 28px;
      }
      .greeting {
        font-size: 18px;
        margin-bottom: 20px;
      }
      .secret-card {
        background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%);
        border: 2px dashed #f87171;
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        margin: 24px 0;
      }
      .secret-label {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #991b1b;
        font-weight: 700;
      }
      .secret-name {
        font-size: 28px;
        font-weight: 900;
        color: #b91c1c;
        margin: 8px 0 4px;
      }
      .details {
        background: #f9fafb;
        border-radius: 12px;
        padding: 16px 20px;
        margin: 20px 0;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .detail-label {
        color: #6b7280;
        font-weight: 500;
      }
      .detail-value {
        font-weight: 700;
        color: #111827;
      }
      .btn {
        display: inline-block;
        background: #dc2626;
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 28px;
        border-radius: 10px;
        font-weight: bold;
        font-size: 15px;
        margin: 12px 0;
      }
      .footer {
        background: #f9fafb;
        padding: 20px;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
        border-top: 1px solid #e5e7eb;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="badge">🎁 Sorteo Oficial</div>
        <h1>¡Hola, ${name}!</h1>
        <p>${eventName || 'Sorteo de Amigo Secreto'}</p>
      </div>

      <div class="content">
        <div class="greeting">
          El sorteo ya se ha completado y se te ha asignado una persona especial para intercambiar regalo. 🤫
        </div>

        <div class="secret-card">
          <div class="secret-label">Tu amigo secreto asignado es:</div>
          <div class="secret-name">🎁 ${secretFriend} 🎁</div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">¡Recuerda mantener el secreto hasta el día del intercambio!</p>
        </div>

        ${(budget || date || notes) ? `
        <div class="details">
          ${budget ? `
          <div class="detail-row">
            <span class="detail-label">💰 Presupuesto sugerido:</span>
            <span class="detail-value">${budget}</span>
          </div>` : ''}
          ${date ? `
          <div class="detail-row">
            <span class="detail-label">📅 Fecha de entrega:</span>
            <span class="detail-value">${date}</span>
          </div>` : ''}
          ${notes ? `
          <div class="detail-row">
            <span class="detail-label">📝 Indicaciones:</span>
            <span class="detail-value">${notes}</span>
          </div>` : ''}
        </div>` : ''}

        ${revealLink ? `
        <div style="text-align: center; margin-top: 20px;">
          <a href="${revealLink}" class="btn" target="_blank">Abrir tarjeta interactiva 🎁</a>
          <p style="font-size: 12px; color: #9ca3af;">También puedes ver tu amigo secreto y consejos en tu tarjeta digital</p>
        </div>` : ''}
      </div>

      <div class="footer">
        Enviado automáticamente mediante la aplicación de Amigo Invisible.<br>
        ¡Que disfruten mucho el intercambio de regalos! 🎄
      </div>
    </div>
  </body>
  </html>
  `;
}

// Endpoint para probar conexión SMTP
app.post('/api/verify-smtp', async (req, res) => {
  try {
    const { smtpConfig } = req.body;
    const transporter = createTransporter(smtpConfig);
    await transporter.verify();
    res.json({ success: true, message: '¡Conexión SMTP exitosa y lista para enviar correos!' });
  } catch (error) {
    console.error('Error verificando SMTP:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'No se pudo conectar al servidor de correo. Verifica usuario y contraseña.'
    });
  }
});

// Endpoint para enviar notificaciones masivas por correo
app.post('/api/send-email', async (req, res) => {
  try {
    const { smtpConfig, recipients, eventDetails } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay destinatarios para enviar.' });
    }

    const transporter = createTransporter(smtpConfig);

    const results = [];
    const fromAddress = smtpConfig.from || `"Amigo Invisible 🎁" <${smtpConfig.user}>`;

    for (const item of recipients) {
      if (!item.email || !item.email.includes('@')) {
        results.push({ name: item.name, email: item.email, success: false, error: 'Correo no válido' });
        continue;
      }

      const html = buildEmailHtml({
        name: item.name,
        secretFriend: item.secretFriend,
        eventName: eventDetails?.name || 'Amigo Invisible',
        budget: eventDetails?.budget || '',
        date: eventDetails?.date || '',
        notes: eventDetails?.notes || '',
        revealLink: item.revealLink || ''
      });

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: item.email,
          subject: `🎁 Tu Amigo Secreto asignado para "${eventDetails?.name || 'el intercambio'}" 🤫`,
          text: `¡Hola ${item.name}! Tu amigo secreto asignado es: ${item.secretFriend}. Presupuesto: ${eventDetails?.budget || 'N/A'}. Fecha: ${eventDetails?.date || 'N/A'}.`,
          html: html
        });
        results.push({ name: item.name, email: item.email, success: true });
      } catch (err) {
        console.error(`Error enviando correo a ${item.email}:`, err);
        results.push({ name: item.name, email: item.email, success: false, error: err.message });
      }
    }

    const successfulCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      sentCount: successfulCount,
      total: recipients.length,
      results
    });
  } catch (error) {
    console.error('Error general en /api/send-email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ocurrió un error al procesar el envío de correos.'
    });
  }
});

// Fallback para SPA / Páginas HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✨ Servidor Amigo Invisible corriendo en http://localhost:${PORT}`);
});
