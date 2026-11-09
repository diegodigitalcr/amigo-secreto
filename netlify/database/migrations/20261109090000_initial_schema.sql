-- Tarjetas individuales autodestruibles (revelar.html)
CREATE TABLE IF NOT EXISTS secrets (
  token       TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  burned      BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Salas grupales con PIN (sala.html)
CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY,
  event       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS rooms_expires_at_idx ON rooms (expires_at);

CREATE TABLE IF NOT EXISTS room_members (
  room_id        TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  name           TEXT NOT NULL,
  secret_friend  TEXT NOT NULL,
  pin            TEXT,
  opened_at      TEXT,
  wishlist       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (room_id, id)
);
