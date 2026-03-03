import pg from 'pg'
const { Pool } = pg

let pool = null
const cache = {}

function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  return pool
}

export async function init() {
  await getPool().query(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v JSONB)`)
  const res = await getPool().query('SELECT k, v FROM kv')
  res.rows.forEach((r) => { cache[r.k] = r.v })
  const keys = ['users', 'channels', 'messages', 'sessions', 'read_state', 'user_prefs']
  for (const k of keys) {
    if (!(k in cache)) {
      cache[k] = (k === 'users' || k === 'channels' || k === 'messages') ? [] : {}
      await getPool().query('INSERT INTO kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO NOTHING', [k, JSON.stringify(cache[k])])
    }
  }
}

function read(name) {
  return cache[name] ?? (name === 'users' || name === 'channels' || name === 'messages' ? [] : {})
}

function write(name, data) {
  cache[name] = typeof data === 'string' ? JSON.parse(data) : data
  getPool().query('INSERT INTO kv (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = $2', [name, JSON.stringify(cache[name])]).catch(() => {})
}

export const store = { read, write, init }
