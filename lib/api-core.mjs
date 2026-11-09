// Lógica del API de Amigo Secreto, independiente de la plataforma.
// Recibe una función `query(text, params)` que devuelve { rows } (estilo pg).
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { buildEmailHtml } from './email-template.mjs';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TIME_ZONE = 'America/Costa_Rica';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

const nowLabel = () =>
  new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE });

const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const randomId = (len) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
};

// 10 días después de la fecha del evento, o 30 días tras la creación si no hay fecha
export function calculateRoomExpiry(event, createdAt = new Date()) {
  const eventDate = event?.date;
  if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    // Fin del día del evento en hora de Costa Rica (UTC-6)
    const eventEnd = new Date(`${eventDate}T23:59:59.999-06:00`);
    if (!isNaN(eventEnd.getTime())) return new Date(eventEnd.getTime() + 10 * MS_PER_DAY);
  }
  return new Date(createdAt.getTime() + 30 * MS_PER_DAY);
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function createTransporter(smtpConfig) {
  if (!smtpConfig || !smtpConfig.user || !smtpConfig.pass) {
    throw new Error('Faltan credenciales de correo (usuario o contraseña).');
  }
  const service = smtpConfig.service ? smtpConfig.service.toLowerCase() : null;
  const auth = { user: smtpConfig.user.trim(), pass: smtpConfig.pass.trim() };

  if (service === 'gmail') return nodemailer.createTransport({ service: 'gmail', auth });
  if (service === 'outlook' || service === 'hotmail') return nodemailer.createTransport({ service: 'hotmail', auth });

  const port = parseInt(smtpConfig.port, 10) || 587;
  return nodemailer.createTransport({
    host: smtpConfig.host || 'smtp.gmail.com',
    port,
    secure: smtpConfig.secure === true || port === 465,
    auth
  });
}

export function createApi({ query, adminKey }) {
  const findMember = async (roomId, memberId, name) => {
    const { rows } = await query(
      `SELECT * FROM room_members
        WHERE room_id = $1 AND ((CAST($2 AS TEXT) IS NOT NULL AND id = $2) OR LOWER(name) = LOWER($3))
        ORDER BY (id = $2) DESC NULLS LAST
        LIMIT 1`,
      [roomId, memberId || null, name || '']
    );
    return rows[0] || null;
  };

  const wishlistOf = async (roomId, personName) => {
    const { rows } = await query(
      'SELECT wishlist FROM room_members WHERE room_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
      [roomId, personName]
    );
    return rows[0]?.wishlist || '';
  };

  const cleanupExpiredRooms = async () => {
    const { rows } = await query('DELETE FROM rooms WHERE expires_at < NOW() RETURNING id', []);
    return rows.length;
  };

  const isAdmin = (req, url) => {
    if (!adminKey) return false;
    const given = req.headers.get('x-admin-key') || url.searchParams.get('key') || '';
    const a = Buffer.from(given);
    const b = Buffer.from(adminKey);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  // ---------------------------------------------------------------------------
  const routes = [
    ['GET', /^\/api\/status$/, async () =>
      json(200, { status: 'online', app: 'Amigo Invisible Pro', time: new Date().toISOString() })],

    // Guardar secretos individuales
    ['POST', /^\/api\/secrets$/, async (req) => {
      const { secrets } = await readBody(req);
      if (!Array.isArray(secrets)) return json(400, { error: 'Lista de secretos no válida' });
      const valid = secrets.filter((s) => s && typeof s.token === 'string' && s.token && s.data).slice(0, 500);
      for (const item of valid) {
        await query(
          `INSERT INTO secrets (token, data) VALUES ($1, $2::jsonb)
           ON CONFLICT (token) DO UPDATE SET data = EXCLUDED.data, burned = FALSE, opened_at = NULL`,
          [item.token.slice(0, 200), JSON.stringify(item.data)]
        );
      }
      return json(200, { success: true, count: valid.length });
    }],

    // Consultar secreto (sin quemarlo)
    ['GET', /^\/api\/secrets\/([^/]+)$/, async (req, [token]) => {
      const { rows } = await query('SELECT * FROM secrets WHERE token = $1', [token]);
      const item = rows[0];
      if (!item) {
        return json(404, { success: false, not_found: true, message: 'Esta tarjeta no existe o ya fue autodestruida.' });
      }
      if (item.burned) {
        return json(410, {
          success: false,
          burned: true,
          to: item.data?.to || 'Participante',
          openedAt: item.opened_at,
          message: 'Esta tarjeta ya fue abierta y se autodestruyó por seguridad.'
        });
      }
      return json(200, { success: true, data: item.data, burned: false });
    }],

    // Quemar secreto al abrir la caja
    ['POST', /^\/api\/secrets\/([^/]+)\/burn$/, async (req, [token]) => {
      const openedAt = nowLabel();
      const { rows } = await query(
        `UPDATE secrets SET burned = TRUE, opened_at = COALESCE(opened_at, $2)
          WHERE token = $1 RETURNING opened_at`,
        [token, openedAt]
      );
      if (!rows[0]) return json(404, { success: false, message: 'No encontrado' });
      return json(200, { success: true, burned: true, openedAt: rows[0].opened_at });
    }],

    // Crear sala grupal
    ['POST', /^\/api\/rooms$/, async (req) => {
      const { eventDetails, pairings } = await readBody(req);
      if (!Array.isArray(pairings) || pairings.length < 3) {
        return json(400, { error: 'Lista de participantes insuficiente' });
      }
      if (pairings.length > 300) return json(400, { error: 'Demasiados participantes' });

      await cleanupExpiredRooms();

      const event = eventDetails && typeof eventDetails === 'object' ? eventDetails : {};
      const createdAt = new Date();
      const roomId = 'sala_' + randomId(7);
      await query(
        'INSERT INTO rooms (id, event, created_at, expires_at) VALUES ($1, $2::jsonb, $3, $4)',
        [roomId, JSON.stringify(event), createdAt.toISOString(), calculateRoomExpiry(event, createdAt).toISOString()]
      );

      const usedIds = new Set();
      for (let i = 0; i < pairings.length; i++) {
        const p = pairings[i] || {};
        let id = String(p.giverId || 'm_' + randomId(6)).slice(0, 100);
        if (usedIds.has(id)) id = id + '_' + randomId(4);
        usedIds.add(id);
        await query(
          `INSERT INTO room_members (room_id, id, position, name, secret_friend)
           VALUES ($1, $2, $3, $4, $5)`,
          [roomId, id, i, String(p.giverName || '').slice(0, 200), String(p.receiverName || '').slice(0, 200)]
        );
      }
      return json(200, { success: true, roomId });
    }],

    // Info pública de la sala (sin revelar amigos secretos)
    ['GET', /^\/api\/rooms\/([^/]+)$/, async (req, [id]) => {
      const { rows } = await query('SELECT * FROM rooms WHERE id = $1 AND expires_at >= NOW()', [id]);
      const room = rows[0];
      if (!room) return json(404, { success: false, error: 'Sala no encontrada' });
      const members = await query(
        'SELECT id, name, pin IS NOT NULL AS has_pin FROM room_members WHERE room_id = $1 ORDER BY position',
        [id]
      );
      return json(200, {
        success: true,
        room: {
          id: room.id,
          event: room.event,
          participants: members.rows.map((m) => ({ id: m.id, name: m.name, hasPin: Boolean(m.has_pin) }))
        }
      });
    }],

    // Desbloquear tarjeta con PIN
    ['POST', /^\/api\/rooms\/([^/]+)\/unlock$/, async (req, [id]) => {
      const { memberId, name, pin } = await readBody(req);
      const { rows } = await query('SELECT * FROM rooms WHERE id = $1 AND expires_at >= NOW()', [id]);
      const room = rows[0];
      if (!room) return json(404, { success: false, error: 'Sala no encontrada' });

      const cleanPin = (pin || '').toString().trim();
      if (!cleanPin || cleanPin.length < 4) {
        return json(400, { success: false, error: 'El PIN debe tener 4 dígitos numéricos' });
      }

      let member = await findMember(id, memberId, name);
      if (!member) return json(404, { success: false, error: 'Participante no encontrado en la sala' });

      let isNewPin = false;
      if (!member.pin) {
        // Solo asigna el PIN si sigue vacío (evita que dos personas lo creen a la vez)
        const upd = await query(
          `UPDATE room_members SET pin = $3, opened_at = $4
            WHERE room_id = $1 AND id = $2 AND pin IS NULL RETURNING *`,
          [id, member.id, cleanPin, nowLabel()]
        );
        if (upd.rows[0]) {
          member = upd.rows[0];
          isNewPin = true;
        } else {
          member = await findMember(id, member.id, member.name);
        }
      }

      if (!isNewPin && member.pin !== cleanPin) {
        return json(401, { success: false, error: 'PIN incorrecto. Ingresa el PIN que creaste la primera vez.' });
      }

      const body = {
        success: true,
        isNewPin,
        to: member.name,
        secret: member.secret_friend,
        secretWishlist: await wishlistOf(id, member.secret_friend),
        myWishlist: member.wishlist || '',
        event: room.event
      };
      if (isNewPin) body.message = '¡PIN creado con éxito! Tu tarjeta ahora está protegida.';
      return json(200, body);
    }],

    // Guardar lista de deseos
    ['POST', /^\/api\/rooms\/([^/]+)\/wishlist$/, async (req, [id]) => {
      const { memberId, name, pin, wishlist } = await readBody(req);
      const { rows } = await query('SELECT id FROM rooms WHERE id = $1 AND expires_at >= NOW()', [id]);
      if (!rows[0]) return json(404, { success: false, error: 'Sala no encontrada' });

      const member = await findMember(id, memberId, name);
      if (!member) return json(404, { success: false, error: 'Participante no encontrado' });

      const cleanPin = (pin || '').toString().trim();
      if (member.pin && member.pin !== cleanPin) {
        return json(401, { success: false, error: 'PIN de seguridad incorrecto' });
      }

      const clean = (wishlist || '').toString().trim().slice(0, 1000);
      await query('UPDATE room_members SET wishlist = $3 WHERE room_id = $1 AND id = $2', [id, member.id, clean]);
      return json(200, { success: true, wishlist: clean, message: '¡Lista de deseos guardada correctamente!' });
    }],

    // --- Administración -------------------------------------------------------
    ['GET', /^\/api\/admin\/overview$/, async (req, _p, url) => {
      if (!isAdmin(req, url)) return json(401, { success: false, error: 'No autorizado' });
      await cleanupExpiredRooms();

      const roomsRes = await query('SELECT * FROM rooms ORDER BY created_at DESC', []);
      const membersRes = await query('SELECT * FROM room_members ORDER BY room_id, position', []);
      const byRoom = new Map();
      for (const m of membersRes.rows) {
        if (!byRoom.has(m.room_id)) byRoom.set(m.room_id, []);
        byRoom.get(m.room_id).push(m);
      }

      const now = Date.now();
      const rooms = roomsRes.rows.map((r) => {
        const expires = new Date(r.expires_at);
        const ev = r.event || {};
        return {
          id: r.id,
          event: {
            name: ev.name || 'Amigo Invisible',
            budget: ev.budget || '',
            date: ev.date || '',
            location: ev.location || '',
            notes: ev.notes || ''
          },
          createdAt: new Date(r.created_at).toISOString(),
          expiresAt: expires.toISOString(),
          daysUntilExpiry: Math.ceil((expires.getTime() - now) / MS_PER_DAY),
          members: (byRoom.get(r.id) || []).map((m) => ({
            id: m.id,
            name: m.name,
            secretFriend: m.secret_friend,
            hasPin: Boolean(m.pin),
            pin: m.pin || null,
            openedAt: m.opened_at || null,
            wishlist: m.wishlist || ''
          }))
        };
      });
      return json(200, { success: true, totalRooms: rooms.length, rooms });
    }],

    ['DELETE', /^\/api\/admin\/rooms\/([^/]+)$/, async (req, [id], url) => {
      if (!isAdmin(req, url)) return json(401, { success: false, error: 'No autorizado' });
      const { rows } = await query('DELETE FROM rooms WHERE id = $1 RETURNING id', [id]);
      if (!rows[0]) return json(404, { success: false, error: 'Sala no encontrada' });
      return json(200, { success: true, message: `Sala ${id} eliminada con éxito` });
    }],

    ['POST', /^\/api\/admin\/cleanup$/, async (req, _p, url) => {
      if (!isAdmin(req, url)) return json(401, { success: false, error: 'No autorizado' });
      const cleaned = await cleanupExpiredRooms();
      const { rows } = await query('SELECT COUNT(*)::int AS n FROM rooms', []);
      return json(200, { success: true, cleaned, remaining: rows[0].n });
    }],

    // --- Correo ---------------------------------------------------------------
    ['POST', /^\/api\/verify-smtp$/, async (req) => {
      try {
        const { smtpConfig } = await readBody(req);
        await createTransporter(smtpConfig).verify();
        return json(200, { success: true, message: '¡Conexión SMTP exitosa y lista para enviar correos!' });
      } catch (error) {
        return json(400, {
          success: false,
          message: error.message || 'No se pudo conectar al servidor de correo. Verifica usuario y contraseña.'
        });
      }
    }],

    ['POST', /^\/api\/send-email$/, async (req) => {
      try {
        const { smtpConfig, recipients, eventDetails } = await readBody(req);
        if (!Array.isArray(recipients) || recipients.length === 0) {
          return json(400, { success: false, message: 'No hay destinatarios para enviar.' });
        }
        const transporter = createTransporter(smtpConfig);
        const fromAddress = smtpConfig.from || `"Amigo Invisible 🎁" <${smtpConfig.user}>`;
        const ev = eventDetails || {};
        const results = [];

        for (const item of recipients.slice(0, 300)) {
          if (!item.email || !String(item.email).includes('@')) {
            results.push({ name: item.name, email: item.email, success: false, error: 'Correo no válido' });
            continue;
          }
          const revealLink = /^https?:\/\//i.test(item.revealLink || '') ? item.revealLink : '';
          const html = buildEmailHtml({
            name: escapeHtml(item.name),
            secretFriend: escapeHtml(item.secretFriend),
            eventName: escapeHtml(ev.name || 'Amigo Invisible'),
            budget: escapeHtml(ev.budget || ''),
            date: escapeHtml(ev.date || ''),
            notes: escapeHtml(ev.notes || ''),
            revealLink: escapeHtml(revealLink)
          });
          try {
            await transporter.sendMail({
              from: fromAddress,
              to: item.email,
              subject: `🎁 Tu Amigo Secreto asignado para "${ev.name || 'el intercambio'}" 🤫`,
              text: `¡Hola ${item.name}! Tu amigo secreto asignado es: ${item.secretFriend}. Presupuesto: ${ev.budget || 'N/A'}. Fecha: ${ev.date || 'N/A'}.`,
              html
            });
            results.push({ name: item.name, email: item.email, success: true });
          } catch (err) {
            results.push({ name: item.name, email: item.email, success: false, error: err.message });
          }
        }
        return json(200, {
          success: true,
          sentCount: results.filter((r) => r.success).length,
          total: recipients.length,
          results
        });
      } catch (error) {
        return json(500, { success: false, message: error.message || 'Ocurrió un error al procesar el envío de correos.' });
      }
    }]
  ];

  return async function handle(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    for (const [method, pattern, fn] of routes) {
      if (req.method !== method) continue;
      const m = path.match(pattern);
      if (m) {
        try {
          return await fn(req, m.slice(1).map(decodeURIComponent), url);
        } catch (err) {
          console.error(`Error en ${method} ${path}:`, err);
          return json(500, { success: false, error: 'Error interno del servidor' });
        }
      }
    }
    return json(404, { success: false, error: 'Ruta no encontrada' });
  };
}
