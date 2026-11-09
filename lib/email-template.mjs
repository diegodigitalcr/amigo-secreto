// Plantilla HTML para los correos (los valores llegan ya escapados desde api-core)
export function buildEmailHtml({ name, secretFriend, eventName, budget, date, notes, revealLink }) {
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
