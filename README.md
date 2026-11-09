# Amigo Secreto (amigosecretoopen.netlify.app)

Sitio estático en `public/` + API en una Netlify Function (`netlify/functions/api.mjs`)
que guarda salas, PINs, listas de deseos y tarjetas en **Netlify Database** (Postgres).

## Estructura
- `public/` frontend (sin cambios salvo `js/admin.js`).
- `netlify/functions/api.mjs` atiende todas las rutas `/api/*`.
- `lib/api-core.mjs` lógica del API; `lib/email-template.mjs` plantilla del correo.
- `netlify/database/migrations/` esquema de la base; Netlify lo aplica en cada deploy.

## Variable de entorno obligatoria
- `ADMIN_KEY`: clave del panel `/admin.html`. Sin ella el panel queda bloqueado.

## Publicar
```
npm install
npx netlify-cli login
npx netlify-cli link        # elegir "amigosecretoopen"
npx netlify-cli deploy --build --prod
```
O conectar este repo de GitHub en Netlify para que publique con cada push.

## Desarrollo local
`npx netlify-cli dev` (usa una base local; las migraciones se aplican con
`npx netlify-cli database migrations apply`).
