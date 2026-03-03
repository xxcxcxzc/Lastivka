import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const USE_PG = !!process.env.DATABASE_URL

let pgStore = null
if (USE_PG) {
  try {
    const mod = await import('./store-pg.js')
    pgStore = mod.store
  } catch (e) {
    console.warn('DATABASE_URL set but pg store failed:', e.message, '- using JSON files')
  }
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJson(name) {
  ensureDir()
  const file = path.join(DATA_DIR, `${name}.json`)
  const def = name === 'users' ? [] : (name === 'sessions' || name === 'user_prefs') ? {} : []
  if (!fs.existsSync(file)) return def
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return def
  }
}

function writeJson(name, data) {
  ensureDir()
  const file = path.join(DATA_DIR, `${name}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function read(name) {
  return (USE_PG && pgStore) ? pgStore.read(name) : readJson(name)
}

function write(name, data) {
  if (USE_PG && pgStore) pgStore.write(name, data)
  else writeJson(name, data)
}

export async function initStore() {
  if (USE_PG && pgStore?.init) await pgStore.init()
}

export function getUsers() {
  return read('users')
}

export function saveUsers(users) {
  write('users', users)
}

export function getChannels() {
  return read('channels')
}

export function saveChannels(channels) {
  write('channels', channels)
}

export function getMessages() {
  return read('messages')
}

export function saveMessages(messages) {
  write('messages', messages)
}

export function getSessions() {
  return read('sessions')
}

export function saveSessions(sessions) {
  write('sessions', sessions)
}

export function getReadState() {
  return read('read_state')
}

export function saveReadState(state) {
  write('read_state', state)
}

export function getUserPrefs() {
  return read('user_prefs')
}

export function saveUserPrefs(prefs) {
  write('user_prefs', prefs)
}

export function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
