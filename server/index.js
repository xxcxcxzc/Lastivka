import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  initStore,
  getUsers,
  saveUsers,
  getChannels,
  saveChannels,
  getMessages,
  saveMessages,
  getSessions,
  saveSessions,
  getReadState,
  saveReadState,
  getUserPrefs,
  saveUserPrefs,
  id,
} from './store.js'

const ADMIN_LASTIVKA_ID = 'moon'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))

const LASTIVKA_ID_RE = /^[A-Za-z_-]+$/

function normalizeLastivkaId(v) {
  return String(v || '').trim()
}

function collectUsedLastivkaIds() {
  const users = getUsers()
  const channels = getChannels()
  const out = new Set()
  users.forEach((u) => {
    if (u.lastivkaId) out.add(u.lastivkaId.toLowerCase())
  })
  channels.forEach((c) => {
    if (c.lastivkaId) out.add(c.lastivkaId.toLowerCase())
  })
  return out
}

function isUniqueLastivkaId(value, ignore = null) {
  const v = value.toLowerCase()
  const used = collectUsedLastivkaIds()
  if (ignore) used.delete(ignore.toLowerCase())
  return !used.has(v)
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token
  const sessions = getSessions()
  const userId = token ? sessions[token] : null
  if (!userId) return res.status(401).json({ error: 'Необхідна авторизація' })
  const user = getUsers().find((u) => u.id === userId)
  if (!user) return res.status(401).json({ error: 'Користувача не знайдено' })
  req.user = user
  req.token = token
  next()
}

function dmKey(a, b) {
  return [a, b].sort().join('::')
}

function hasChannelAccess(channel, userId) {
  if (!channel) return false
  if (channel.visibility !== 'private') return true
  const members = channel.members || []
  return channel.ownerId === userId || members.includes(userId)
}

function isChannelMember(channel, userId) {
  if (!channel) return false
  const members = channel.members || []
  return channel.ownerId === userId || members.includes(userId)
}

function visibleMessagesForUser(messages, userId) {
  return messages.filter((m) => !(m.deletedFor || []).includes(userId))
}

function getMessageById(messageId) {
  const messages = getMessages()
  const index = messages.findIndex((m) => m.id === messageId)
  return { messages, index, message: index >= 0 ? messages[index] : null }
}

// Auth
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, lastivkaId } = req.body || {}
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'Заповніть усі поля' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль має бути не менше 6 символів' })

  const users = getUsers()
  if (users.some((u) => u.email && u.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Користувач з таким email вже існує' })
  }

  let lid = normalizeLastivkaId(lastivkaId)
  if (lid) {
    if (!LASTIVKA_ID_RE.test(lid)) {
      return res.status(400).json({ error: 'Lastivka-id: тільки англ. літери, - та _' })
    }
    if (!isUniqueLastivkaId(lid)) {
      return res.status(400).json({ error: 'Такий Lastivka-id вже зайнятий' })
    }
  } else {
    lid = null
  }

  const newUser = {
    id: `user-${id()}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    lastivkaId: lid,
  }
  users.push(newUser)
  saveUsers(users)

  const token = id()
  const sessions = getSessions()
  sessions[token] = newUser.id
  saveSessions(sessions)

  res.json({ user: { id: newUser.id, name: newUser.name, email: newUser.email, lastivkaId: newUser.lastivkaId }, token })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  const user = getUsers().find(
    (u) => u.email && u.email.toLowerCase() === (email || '').trim().toLowerCase() && u.password === password
  )
  if (!user) return res.status(401).json({ error: 'Невірний email або пароль' })

  const token = id()
  const sessions = getSessions()
  sessions[token] = user.id
  saveSessions(sessions)
  res.json({ user: { id: user.id, name: user.name, email: user.email, lastivkaId: user.lastivkaId || null }, token })
})

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, lastivkaId: req.user.lastivkaId || null } })
})

function handleProfileUpdate(req, res) {
  const { name, lastivkaId } = req.body || {}
  const users = getUsers()
  const idx = users.findIndex((u) => u.id === req.user.id)
  if (idx < 0) return res.status(404).json({ error: 'Користувача не знайдено' })

  if (name?.trim()) users[idx].name = name.trim()

  const lid = normalizeLastivkaId(lastivkaId)
  if (lid) {
    if (!LASTIVKA_ID_RE.test(lid)) return res.status(400).json({ error: 'Lastivka-id: тільки англ. літери, - та _' })
    if (!isUniqueLastivkaId(lid, users[idx].lastivkaId || null)) return res.status(400).json({ error: 'Такий Lastivka-id вже зайнятий' })
    users[idx].lastivkaId = lid
  } else {
    users[idx].lastivkaId = null
  }

  saveUsers(users)
  const u = users[idx]
  res.json({ user: { id: u.id, name: u.name, email: u.email, lastivkaId: u.lastivkaId || null } })
}

app.patch('/api/auth/me', auth, handleProfileUpdate)
app.put('/api/auth/me', auth, handleProfileUpdate)
app.post('/api/auth/me/update', auth, handleProfileUpdate)
app.post('/api/auth/profile', auth, handleProfileUpdate)

function isAdmin(user) {
  return user && (user.lastivkaId || '').toLowerCase() === ADMIN_LASTIVKA_ID
}

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const sessions = getSessions()
    delete sessions[token]
    saveSessions(sessions)
  }
  res.json({ ok: true })
})

// Channels & groups
app.get('/api/channels', auth, (_req, res) => {
  const channels = getChannels().filter((c) => isChannelMember(c, _req.user.id))
  res.json({ channels })
})

app.post('/api/channels', auth, (req, res) => {
  const { name, description, kind, lastivkaId, visibility, memberIds, avatar } = req.body || {}
  if (!name?.trim()) return res.status(400).json({ error: 'Введіть назву каналу/групи' })

  const normalizedVisibility = visibility === 'private' ? 'private' : 'public'
  const lid = normalizeLastivkaId(lastivkaId)
  if (normalizedVisibility === 'public') {
    if (!lid) return res.status(400).json({ error: 'Lastivka-id для публічного каналу обовʼязковий' })
    if (!LASTIVKA_ID_RE.test(lid)) return res.status(400).json({ error: 'Lastivka-id: тільки англ. літери, - та _' })
    if (!isUniqueLastivkaId(lid)) return res.status(400).json({ error: 'Такий Lastivka-id вже зайнятий' })
  }

  const channels = getChannels()
  const channel = {
    id: `ch-${id()}`,
    name: name.trim(),
    description: (description || '').trim(),
    kind: kind === 'group' ? 'group' : 'channel',
    ownerId: req.user.id,
    discussionEnabled: true,
    commentsEnabled: true,
    visibility: normalizedVisibility,
    inviteCode: normalizedVisibility === 'private' ? id() : null,
    avatar: avatar || null,
    members: Array.from(new Set([req.user.id, ...((memberIds || []).filter(Boolean))])),
    lastivkaId: normalizedVisibility === 'public' ? lid : null,
  }
  channels.push(channel)
  saveChannels(channels)
  res.json(channel)
})

app.patch('/api/channels/:id', auth, (req, res) => {
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  const ch = channels[idx]
  if (ch.ownerId !== req.user.id) return res.status(403).json({ error: 'Немає прав керування каналом' })

  const { name, description, lastivkaId, visibility, discussionEnabled, commentsEnabled, memberIds, avatar } = req.body || {}
  if (name?.trim()) ch.name = name.trim()
  if (typeof description === 'string') ch.description = description.trim()
  if (visibility === 'public' || visibility === 'private') {
    ch.visibility = visibility
    ch.inviteCode = visibility === 'private' ? (ch.inviteCode || id()) : null
    if (visibility === 'private') ch.lastivkaId = null
  }
  if (typeof discussionEnabled === 'boolean') ch.discussionEnabled = discussionEnabled
  if (typeof commentsEnabled === 'boolean') ch.commentsEnabled = commentsEnabled
  if (Array.isArray(memberIds)) ch.members = Array.from(new Set([ch.ownerId, ...memberIds]))
  if (avatar !== undefined) ch.avatar = avatar || null

  if (lastivkaId !== undefined) {
    const lid = normalizeLastivkaId(lastivkaId)
    if (ch.visibility === 'private') {
      ch.lastivkaId = null
    } else {
      if (!lid) return res.status(400).json({ error: 'Lastivka-id не може бути порожнім' })
      if (!LASTIVKA_ID_RE.test(lid)) return res.status(400).json({ error: 'Lastivka-id: тільки англ. літери, - та _' })
      if (!isUniqueLastivkaId(lid, ch.lastivkaId || null)) return res.status(400).json({ error: 'Такий Lastivka-id вже зайнятий' })
      ch.lastivkaId = lid
    }
  }
  if (ch.visibility !== 'private' && !ch.lastivkaId) {
    return res.status(400).json({ error: 'Для публічного каналу потрібен Lastivka-id' })
  }

  channels[idx] = ch
  saveChannels(channels)
  res.json(ch)
})

app.post('/api/channels/:id/update', auth, (req, res) => {
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  const ch = channels[idx]
  if (ch.ownerId !== req.user.id) return res.status(403).json({ error: 'Немає прав керування каналом' })

  const { name, description, lastivkaId, visibility, discussionEnabled, commentsEnabled, memberIds, avatar } = req.body || {}
  if (name?.trim()) ch.name = name.trim()
  if (typeof description === 'string') ch.description = description.trim()
  if (visibility === 'public' || visibility === 'private') {
    ch.visibility = visibility
    ch.inviteCode = visibility === 'private' ? (ch.inviteCode || id()) : null
    if (visibility === 'private') ch.lastivkaId = null
  }
  if (typeof discussionEnabled === 'boolean') ch.discussionEnabled = discussionEnabled
  if (typeof commentsEnabled === 'boolean') ch.commentsEnabled = commentsEnabled
  if (Array.isArray(memberIds)) ch.members = Array.from(new Set([ch.ownerId, ...memberIds]))
  if (avatar !== undefined) ch.avatar = avatar || null

  if (lastivkaId !== undefined) {
    const lid = normalizeLastivkaId(lastivkaId)
    if (ch.visibility === 'private') {
      ch.lastivkaId = null
    } else {
      if (!lid) return res.status(400).json({ error: 'Lastivka-id не може бути порожнім' })
      if (!LASTIVKA_ID_RE.test(lid)) return res.status(400).json({ error: 'Lastivka-id: тільки англ. літери, - та _' })
      if (!isUniqueLastivkaId(lid, ch.lastivkaId || null)) return res.status(400).json({ error: 'Такий Lastivka-id вже зайнятий' })
      ch.lastivkaId = lid
    }
  }
  if (ch.visibility !== 'private' && !ch.lastivkaId) {
    return res.status(400).json({ error: 'Для публічного каналу потрібен Lastivka-id' })
  }

  channels[idx] = ch
  saveChannels(channels)
  res.json(ch)
})

app.get('/api/channels/:id/members', auth, (req, res) => {
  const channel = getChannels().find((c) => c.id === req.params.id)
  if (!channel) return res.status(404).json({ error: 'Канал не знайдено' })
  if (!hasChannelAccess(channel, req.user.id)) return res.status(403).json({ error: 'Немає доступу' })

  const users = getUsers()
  const members = (channel.members || [])
    .map((uid) => users.find((u) => u.id === uid))
    .filter(Boolean)
    .map((u) => ({ id: u.id, name: u.name, lastivkaId: u.lastivkaId || null }))
  res.json({ members })
})

app.post('/api/channels/:id/members', auth, (req, res) => {
  const { userId } = req.body || {}
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  if (channels[idx].ownerId !== req.user.id) return res.status(403).json({ error: 'Немає прав керування каналом' })
  if (!userId) return res.status(400).json({ error: 'Вкажіть userId' })
  channels[idx].members = Array.from(new Set([...(channels[idx].members || []), userId, channels[idx].ownerId]))
  saveChannels(channels)
  res.json({ ok: true, channel: channels[idx] })
})

app.delete('/api/channels/:id/members/:userId', auth, (req, res) => {
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  if (channels[idx].ownerId !== req.user.id) return res.status(403).json({ error: 'Немає прав керування каналом' })
  const uid = req.params.userId
  channels[idx].members = (channels[idx].members || []).filter((x) => x !== uid || x === channels[idx].ownerId)
  if (!channels[idx].members.includes(channels[idx].ownerId)) channels[idx].members.push(channels[idx].ownerId)
  saveChannels(channels)
  res.json({ ok: true, channel: channels[idx] })
})

app.post('/api/channels/:id/members/:userId/remove', auth, (req, res) => {
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  if (channels[idx].ownerId !== req.user.id) return res.status(403).json({ error: 'Немає прав керування каналом' })
  const uid = req.params.userId
  channels[idx].members = (channels[idx].members || []).filter((x) => x !== uid || x === channels[idx].ownerId)
  if (!channels[idx].members.includes(channels[idx].ownerId)) channels[idx].members.push(channels[idx].ownerId)
  saveChannels(channels)
  res.json({ ok: true, channel: channels[idx] })
})

app.post('/api/channels/:id/join', auth, (req, res) => {
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  const ch = channels[idx]
  if (ch.visibility === 'private') return res.status(403).json({ error: 'Приватний канал: потрібне запрошення' })
  ch.members = Array.from(new Set([...(ch.members || []), req.user.id, ch.ownerId]))
  channels[idx] = ch
  saveChannels(channels)
  res.json({ ok: true, channel: ch })
})

app.post('/api/channels/:id/leave', auth, (req, res) => {
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  const ch = channels[idx]
  if (ch.ownerId === req.user.id) return res.status(400).json({ error: 'Власник не може покинути власний канал' })
  ch.members = (ch.members || []).filter((uid) => uid !== req.user.id)
  channels[idx] = ch
  saveChannels(channels)
  res.json({ ok: true, channel: ch })
})

app.get('/api/channels/:id/messages', auth, (req, res) => {
  const channel = getChannels().find((c) => c.id === req.params.id)
  if (!channel) return res.status(404).json({ error: 'Канал не знайдено' })
  if (!hasChannelAccess(channel, req.user.id)) return res.status(403).json({ error: 'Немає доступу' })
  const all = getMessages().filter((m) => m.type === 'channel' && m.channelId === req.params.id)
  const messages = visibleMessagesForUser(all, req.user.id)
  res.json({ messages })
})

app.post('/api/channels/:id/messages', auth, (req, res) => {
  const { text, attachment } = req.body || {}
  const textStr = String(text || '').trim()
  if (!textStr && !attachment) return res.status(400).json({ error: 'Текст або вкладення обовʼязкове' })

  const channels = getChannels()
  const channel = channels.find((c) => c.id === req.params.id)
  if (!channel) return res.status(404).json({ error: 'Канал не знайдено' })
  if (!hasChannelAccess(channel, req.user.id)) return res.status(403).json({ error: 'Немає доступу' })
  if (!isChannelMember(channel, req.user.id)) return res.status(403).json({ error: 'Спочатку приєднайтесь до каналу' })
  if (channel.commentsEnabled === false) return res.status(403).json({ error: 'Писати в канал заборонено адміністратором' })

  const msg = {
    id: `msg-${id()}`,
    type: 'channel',
    channelId: req.params.id,
    authorId: `channel-${channel.id}`,
    authorName: channel.name,
    postedByUserId: req.user.id,
    postedByUserName: req.user.name,
    text: textStr.slice(0, 2000),
    attachment: attachment || null,
    time: new Date().toISOString(),
    deletedFor: [],
    reactions: {},
    viewCount: 0,
  }
  const messages = getMessages()
  messages.push(msg)
  saveMessages(messages)
  res.json(msg)
})

app.get('/api/channels/:id/discussion', auth, (req, res) => {
  const channel = getChannels().find((c) => c.id === req.params.id)
  if (!channel) return res.status(404).json({ error: 'Канал не знайдено' })
  if (!hasChannelAccess(channel, req.user.id)) return res.status(403).json({ error: 'Немає доступу' })
  const parentId = req.query.parentId || null
  let all = getMessages().filter((m) => m.type === 'discussion' && m.channelId === req.params.id)
  if (parentId) all = all.filter((m) => m.parentMessageId === parentId)
  else all = all.filter((m) => !m.parentMessageId)
  const messages = visibleMessagesForUser(all, req.user.id)
  res.json({ messages })
})

app.post('/api/channels/:id/discussion', auth, (req, res) => {
  const { text, parentMessageId, attachment } = req.body || {}
  const textStr = String(text || '').trim()
  if (!textStr && !attachment) return res.status(400).json({ error: 'Текст або вкладення обовʼязкове' })

  const channel = getChannels().find((c) => c.id === req.params.id)
  if (!channel) return res.status(404).json({ error: 'Канал не знайдено' })
  if (!hasChannelAccess(channel, req.user.id)) return res.status(403).json({ error: 'Немає доступу' })
  if (!isChannelMember(channel, req.user.id)) return res.status(403).json({ error: 'Спочатку приєднайтесь до каналу' })
  if (channel.discussionEnabled === false) return res.status(403).json({ error: 'Обговорення вимкнено адміністратором' })

  const msg = {
    id: `msg-${id()}`,
    type: 'discussion',
    channelId: req.params.id,
    parentMessageId: parentMessageId || null,
    authorId: `discussion-${channel.id}`,
    authorName: req.user.name,
    postedByUserId: req.user.id,
    postedByUserName: req.user.name,
    text: textStr.slice(0, 2000),
    attachment: attachment || null,
    time: new Date().toISOString(),
    deletedFor: [],
    reactions: {},
    viewCount: 0,
  }
  const messages = getMessages()
  messages.push(msg)
  saveMessages(messages)
  res.json(msg)
})

// Users
app.get('/api/users', auth, (req, res) => {
  const users = getUsers()
    .filter((u) => u.id !== req.user.id)
    .map((u) => ({ id: u.id, name: u.name, lastivkaId: u.lastivkaId || null }))
  res.json({ users })
})

// DMs
app.get('/api/dms', auth, (req, res) => {
  const messages = getMessages().filter((m) => m.type === 'dm')
  const keys = new Set()
  messages.forEach((m) => {
    if (m.dmKey && m.dmKey.includes(req.user.id)) keys.add(m.dmKey)
  })
  const users = getUsers()
  const dms = []
  keys.forEach((key) => {
    const [id1, id2] = key.split('::')
    const otherId = id1 === req.user.id ? id2 : id1
    const other = users.find((u) => u.id === otherId)
    if (other) dms.push({ userId: other.id, userName: other.name, lastivkaId: other.lastivkaId || null })
  })
  res.json({ dms })
})

app.post('/api/dms', auth, (req, res) => {
  const { userId, userName, lastivkaId } = req.body || {}
  const users = getUsers()

  let other = null
  if (userId) other = users.find((u) => u.id === userId)
  if (!other && lastivkaId) other = users.find((u) => (u.lastivkaId || '').toLowerCase() === String(lastivkaId).toLowerCase())
  if (!other && userName) other = users.find((u) => (u.name || '').trim().toLowerCase() === String(userName).trim().toLowerCase())

  if (!other && userName?.trim()) {
    other = { id: `contact-${id()}`, name: userName.trim(), email: null, password: null, lastivkaId: null }
    users.push(other)
    saveUsers(users)
  }

  if (!other) return res.status(400).json({ error: 'Вкажіть userId, userName або lastivkaId' })
  if (other.id === req.user.id) return res.status(400).json({ error: 'Не можна почати діалог із собою' })

  res.json({ userId: other.id, userName: other.name, lastivkaId: other.lastivkaId || null })
})

app.get('/api/dms/:userId/messages', auth, (req, res) => {
  const key = dmKey(req.user.id, req.params.userId)
  const all = getMessages().filter((m) => m.type === 'dm' && m.dmKey === key)
  const messages = visibleMessagesForUser(all, req.user.id)
  res.json({ messages })
})

app.post('/api/dms/:userId/messages', auth, (req, res) => {
  const { text, attachment } = req.body || {}
  const textStr = String(text || '').trim()
  if (!textStr && !attachment) return res.status(400).json({ error: 'Текст або вкладення обовʼязкове' })

  const key = dmKey(req.user.id, req.params.userId)
  const msg = {
    id: `msg-${id()}`,
    type: 'dm',
    dmKey: key,
    authorId: req.user.id,
    authorName: req.user.name,
    text: textStr.slice(0, 2000),
    attachment: attachment || null,
    time: new Date().toISOString(),
    deletedFor: [],
    reactions: {},
  }
  const messages = getMessages()
  messages.push(msg)
  saveMessages(messages)
  res.json(msg)
})

// Message actions
app.patch('/api/messages/:id', auth, (req, res) => {
  const { text } = req.body || {}
  if (!(text && String(text).trim())) return res.status(400).json({ error: 'Текст не може бути порожнім' })

  const { messages, index, message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })
  const canEditOwn =
    message.authorId === req.user.id ||
    ((message.type === 'channel' || message.type === 'discussion') && message.postedByUserId === req.user.id)
  if (!canEditOwn) return res.status(403).json({ error: 'Редагувати можна лише свої повідомлення' })

  message.text = String(text).trim().slice(0, 2000)
  message.editedAt = new Date().toISOString()
  messages[index] = message
  saveMessages(messages)
  res.json(message)
})

app.post('/api/messages/:id/edit', auth, (req, res) => {
  const { text } = req.body || {}
  if (!(text && String(text).trim())) return res.status(400).json({ error: 'Текст не може бути порожнім' })

  const { messages, index, message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })
  const canEditOwn =
    message.authorId === req.user.id ||
    ((message.type === 'channel' || message.type === 'discussion') && message.postedByUserId === req.user.id)
  if (!canEditOwn) return res.status(403).json({ error: 'Редагувати можна лише свої повідомлення' })

  message.text = String(text).trim().slice(0, 2000)
  message.editedAt = new Date().toISOString()
  messages[index] = message
  saveMessages(messages)
  res.json(message)
})

app.delete('/api/messages/:id', auth, (req, res) => {
  const scope = req.query.scope === 'all' ? 'all' : 'self'
  const { messages, index, message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })

  if (scope === 'all') {
    let allowed =
      message.authorId === req.user.id ||
      ((message.type === 'channel' || message.type === 'discussion') && message.postedByUserId === req.user.id)
    if (!allowed && (message.type === 'channel' || message.type === 'discussion')) {
      const channel = getChannels().find((c) => c.id === message.channelId)
      allowed = channel?.ownerId === req.user.id
    }
    if (!allowed) return res.status(403).json({ error: 'Немає прав видалення для всіх' })

    messages.splice(index, 1)
    saveMessages(messages)
    return res.json({ ok: true })
  }

  const deletedFor = new Set(message.deletedFor || [])
  deletedFor.add(req.user.id)
  message.deletedFor = [...deletedFor]
  messages[index] = message
  saveMessages(messages)
  res.json({ ok: true })
})

app.post('/api/messages/:id/remove', auth, (req, res) => {
  const scope = req.body?.scope === 'all' ? 'all' : 'self'
  const { messages, index, message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })

  if (scope === 'all') {
    let allowed =
      message.authorId === req.user.id ||
      ((message.type === 'channel' || message.type === 'discussion') && message.postedByUserId === req.user.id)
    if (!allowed && (message.type === 'channel' || message.type === 'discussion')) {
      const channel = getChannels().find((c) => c.id === message.channelId)
      allowed = channel?.ownerId === req.user.id
    }
    if (!allowed) return res.status(403).json({ error: 'Немає прав видалення для всіх' })

    messages.splice(index, 1)
    saveMessages(messages)
    return res.json({ ok: true })
  }

  const deletedFor = new Set(message.deletedFor || [])
  deletedFor.add(req.user.id)
  message.deletedFor = [...deletedFor]
  messages[index] = message
  saveMessages(messages)
  res.json({ ok: true })
})

app.post('/api/messages/:id/delete', auth, (req, res) => {
  const scope = req.body?.scope === 'all' ? 'all' : 'self'
  const { messages, index, message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })

  if (scope === 'all') {
    let allowed =
      message.authorId === req.user.id ||
      ((message.type === 'channel' || message.type === 'discussion') && message.postedByUserId === req.user.id)
    if (!allowed && (message.type === 'channel' || message.type === 'discussion')) {
      const channel = getChannels().find((c) => c.id === message.channelId)
      allowed = channel?.ownerId === req.user.id
    }
    if (!allowed) return res.status(403).json({ error: 'Немає прав видалення для всіх' })

    messages.splice(index, 1)
    saveMessages(messages)
    return res.json({ ok: true })
  }

  const deletedFor = new Set(message.deletedFor || [])
  deletedFor.add(req.user.id)
  message.deletedFor = [...deletedFor]
  messages[index] = message
  saveMessages(messages)
  res.json({ ok: true })
})

app.post('/api/messages/:id/pin', auth, (req, res) => {
  const { message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })
  if (!(message.type === 'channel' || message.type === 'discussion')) return res.status(400).json({ error: 'Закріплення доступне лише в каналі/обговоренні' })

  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === message.channelId)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  if (channels[idx].ownerId !== req.user.id) return res.status(403).json({ error: 'Немає прав закріплення' })

  if (message.type === 'channel') channels[idx].pinnedMessageId = message.id
  else channels[idx].discussionPinnedMessageId = message.id

  saveChannels(channels)
  res.json({ ok: true })
})

app.post('/api/messages/:id/reaction', auth, (req, res) => {
  const { emoji } = req.body || {}
  const em = String(emoji || '').trim().slice(0, 8)
  if (!em) return res.status(400).json({ error: 'Вкажіть емодзі' })

  const { messages, index, message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })

  const reactions = message.reactions || {}
  const userId = req.user.id

  for (const e of Object.keys(reactions)) {
    const arr = Array.isArray(reactions[e]) ? reactions[e].filter((id) => id !== userId) : []
    if (arr.length === 0) delete reactions[e]
    else reactions[e] = arr
  }

  const userIds = Array.isArray(reactions[em]) ? reactions[em] : []
  if (userIds.includes(userId)) {
    if (userIds.length === 1) delete reactions[em]
    else reactions[em] = userIds.filter((id) => id !== userId)
  } else {
    reactions[em] = [...userIds, userId]
  }

  message.reactions = reactions
  messages[index] = message
  saveMessages(messages)
  res.json({ reactions: message.reactions })
})

app.post('/api/messages/:id/forward', auth, (req, res) => {
  const { targetType, targetId } = req.body || {}
  const { message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })

  const forwardNote = {
    id: message.id,
    authorName: message.authorName,
    sourceType: message.type,
    channelId: message.channelId || null,
    dmKey: message.dmKey || null,
  }

  if (targetType === 'dm') {
    const key = dmKey(req.user.id, targetId)
    const msg = {
      id: `msg-${id()}`,
      type: 'dm',
      dmKey: key,
      authorId: req.user.id,
      authorName: req.user.name,
      text: message.text,
      forwardedFrom: forwardNote,
      time: new Date().toISOString(),
      deletedFor: [],
    }
    const messages = getMessages()
    messages.push(msg)
    saveMessages(messages)
    return res.json(msg)
  }

  if (targetType === 'channel' || targetType === 'discussion') {
    const channel = getChannels().find((c) => c.id === targetId)
    if (!channel) return res.status(404).json({ error: 'Канал не знайдено' })

    const msg = {
      id: `msg-${id()}`,
      type: targetType,
      channelId: targetId,
      authorId: targetType === 'channel' ? `channel-${targetId}` : `discussion-${targetId}`,
      authorName: targetType === 'channel' ? channel.name : `Обговорення · ${channel.name}`,
      postedByUserId: req.user.id,
      postedByUserName: req.user.name,
      text: message.text,
      forwardedFrom: forwardNote,
      time: new Date().toISOString(),
      deletedFor: [],
    }
    const messages = getMessages()
    messages.push(msg)
    saveMessages(messages)
    return res.json(msg)
  }

  return res.status(400).json({ error: 'Невірна ціль пересилання' })
})

// Dialog list + unread
app.get('/api/dialogs', auth, (req, res) => {
  const userId = req.user.id
  const messages = getMessages()
  const channels = getChannels()
  const users = getUsers()
  const readState = getReadState()
  const userRead = readState[userId] || {}

  const dialogs = []

  channels.forEach((c) => {
    if (!isChannelMember(c, userId)) return
    ;['channel', 'discussion'].forEach((type) => {
      const key = `${type}:${c.id}`
      const relevant = visibleMessagesForUser(
        messages.filter((m) => m.type === type && m.channelId === c.id),
        userId
      )
      const last = relevant.sort((a, b) => new Date(b.time) - new Date(a.time))[0] || null
      const seenAt = userRead[key] ? new Date(userRead[key]).getTime() : 0
      const unread = relevant.filter((m) => (m.postedByUserId || m.authorId) !== userId && new Date(m.time).getTime() > seenAt).length
      dialogs.push({
        key,
        type,
        id: c.id,
        title: type === 'channel' ? c.name : `Обговорення · ${c.name}`,
        subtitle: c.lastivkaId ? `@${c.lastivkaId}` : (c.description || ''),
        lastMessage: last?.text || '',
        lastMessageAt: last?.time || null,
        unreadCount: unread,
        avatar: c.avatar || null,
        official: !!(type === 'channel' && c.official),
      })
    })
  })

  const dmMap = new Map()
  messages
    .filter((m) => m.type === 'dm' && m.dmKey && m.dmKey.includes(userId))
    .forEach((m) => {
      const [a, b] = m.dmKey.split('::')
      const otherId = a === userId ? b : a
      const key = `dm:${m.dmKey}`
      if (!dmMap.has(key)) dmMap.set(key, { key, otherId, messages: [] })
      dmMap.get(key).messages.push(m)
    })

  dmMap.forEach((entry) => {
    const visible = visibleMessagesForUser(entry.messages, userId)
    const last = visible.sort((a, b) => new Date(b.time) - new Date(a.time))[0] || null
    const other = users.find((u) => u.id === entry.otherId)
    const seenAt = userRead[entry.key] ? new Date(userRead[entry.key]).getTime() : 0
    const unread = visible.filter((m) => m.authorId !== userId && new Date(m.time).getTime() > seenAt).length
    dialogs.push({
      key: entry.key,
      type: 'dm',
      id: entry.otherId,
      title: other?.name || 'Користувач',
      subtitle: other?.lastivkaId ? `@${other.lastivkaId}` : '',
      lastMessage: last?.text || '',
      lastMessageAt: last?.time || null,
      unreadCount: unread,
      avatar: other?.avatar || null,
      official: false,
    })
  })

  const userPrefs = getUserPrefs()[userId] || { pinned: [], muted: {}, notifications: {} }
  const pinned = userPrefs.pinned || []
  const muted = userPrefs.muted || {}
  const notifications = userPrefs.notifications || {}

  dialogs.forEach((d) => {
    d.pinned = pinned.includes(d.key)
    d.muted = !!muted[d.key]
    d.notifications = notifications[d.key] !== false
  })

  dialogs.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (a.pinned && b.pinned) {
      const ai = pinned.indexOf(a.key)
      const bi = pinned.indexOf(b.key)
      return ai - bi
    }
    if (!a.lastMessageAt && !b.lastMessageAt) return a.title.localeCompare(b.title)
    if (!a.lastMessageAt) return 1
    if (!b.lastMessageAt) return -1
    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
  })

  res.json({ dialogs, storage: process.env.DATABASE_URL ? 'postgresql' : 'json' })
})

// Admin: set channel official (only @moon)
app.patch('/api/admin/channels/:id/official', auth, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Немає прав адміністратора' })
  const { official } = req.body || {}
  const channels = getChannels()
  const idx = channels.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Канал не знайдено' })
  channels[idx].official = !!official
  saveChannels(channels)
  res.json({ ok: true, channel: channels[idx] })
})

// User prefs: pinned, muted, notifications
app.get('/api/user-prefs', auth, (req, res) => {
  const prefs = getUserPrefs()
  const userPrefs = prefs[req.user.id] || { pinned: [] }
  res.json(userPrefs)
})

app.patch('/api/user-prefs', auth, (req, res) => {
  const { pinned, muted, notifications } = req.body || {}
  const prefs = getUserPrefs()
  if (!prefs[req.user.id]) prefs[req.user.id] = { pinned: [] }
  const up = prefs[req.user.id]
  if (Array.isArray(pinned)) {
    up.pinned = pinned.slice(0, 13)
  }
  if (typeof muted === 'object' && muted !== null) {
    up.muted = up.muted || {}
    Object.assign(up.muted, muted)
  }
  if (typeof notifications === 'object' && notifications !== null) {
    up.notifications = up.notifications || {}
    Object.assign(up.notifications, notifications)
  }
  saveUserPrefs(prefs)
  res.json(prefs[req.user.id])
})

app.post('/api/dialogs/:key/read', auth, (req, res) => {
  const state = getReadState()
  if (!state[req.user.id]) state[req.user.id] = {}
  state[req.user.id][req.params.key] = new Date().toISOString()
  saveReadState(state)
  res.json({ ok: true })
})

// Record view for message (for popularity)
app.post('/api/messages/:id/view', auth, (req, res) => {
  const { messages, index, message } = getMessageById(req.params.id)
  if (!message) return res.status(404).json({ error: 'Повідомлення не знайдено' })
  message.viewCount = (message.viewCount || 0) + 1
  messages[index] = message
  saveMessages(messages)
  res.json({ ok: true, viewCount: message.viewCount })
})

app.post('/api/messages/views', auth, (req, res) => {
  const ids = req.body?.messageIds
  if (!Array.isArray(ids) || ids.length > 100) return res.status(400).json({ error: 'Потрібен масив messageIds (до 100)' })
  const messages = getMessages()
  ids.forEach((msgId) => {
    const idx = messages.findIndex((m) => m.id === msgId)
    if (idx >= 0) messages[idx].viewCount = (messages[idx].viewCount || 0) + 1
  })
  saveMessages(messages)
  res.json({ ok: true })
})

// Feed: popular posts from channels user is in (by viewCount, day window 12:00–00:00 uses viewCount for now)
app.get('/api/feed/popular', auth, (req, res) => {
  const channels = getChannels()
  const myChannelIds = new Set(channels.filter((c) => isChannelMember(c, req.user.id)).map((c) => c.id))
  const messages = getMessages()
  const posts = messages
    .filter((m) => m.type === 'channel' && myChannelIds.has(m.channelId))
    .filter((m) => !(m.deletedFor || []).includes(req.user.id))
    .map((m) => ({ ...m, viewCount: m.viewCount || 0 }))
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 80)
  const channelMap = Object.fromEntries(channels.map((c) => [c.id, c]))
  const withChannel = posts.map((m) => ({ ...m, channel: channelMap[m.channelId] || null }))
  res.json({ posts: withChannel })
})

// Feed: all messages containing keywords (from public channels + user's channels + user's DMs)
app.get('/api/feed/keywords', auth, (req, res) => {
  const raw = (req.query.keywords || '').trim()
  const keywords = raw ? raw.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean) : []
  if (keywords.length === 0) return res.json({ messages: [] })
  const channels = getChannels()
  const messages = getMessages()
  const userChannels = new Set(channels.filter((c) => isChannelMember(c, req.user.id)).map((c) => c.id))
  const publicChannels = new Set(channels.filter((c) => c.visibility === 'public').map((c) => c.id))
  const allowedChannelIds = new Set([...userChannels, ...publicChannels])
  const dmKeys = new Set()
  messages.filter((m) => m.type === 'dm').forEach((m) => {
    if (m.dmKey && m.dmKey.includes(req.user.id)) dmKeys.add(m.dmKey)
  })
  const textMatch = (text) => text && keywords.some((kw) => String(text).toLowerCase().includes(kw))
  const filtered = messages
    .filter((m) => {
      if (!textMatch(m.text)) return false
      if ((m.deletedFor || []).includes(req.user.id)) return false
      if (m.type === 'channel' || m.type === 'discussion') return allowedChannelIds.has(m.channelId)
      if (m.type === 'dm') return dmKeys.has(m.dmKey)
      return false
    })
    .map((m) => ({
      ...m,
      chatKey: m.type === 'channel' ? m.channelId : m.type === 'discussion' ? `discussion-${m.channelId}` : `dm-${m.dmKey}`,
    }))
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 100)
  res.json({ messages: filtered })
})

// Search
app.get('/api/search', auth, (req, res) => {
  let q = (req.query.q || '').trim().toLowerCase()
  if (q.startsWith('@')) q = q.slice(1)
  const filter = req.query.filter || 'all'
  const channels = getChannels()
  const users = getUsers()
  const messages = getMessages()

  let channelResults = []
  let userResults = []
  let messageResults = []

  const matchLastivkaId = (lid) => lid && (lid.toLowerCase() === q || lid.toLowerCase().startsWith(q) || lid.toLowerCase().includes(q))

  if (q) {
    if (filter === 'all' || filter === 'channels') {
      channelResults = channels.filter(
        (c) =>
          (c.visibility === 'public' || hasChannelAccess(c, req.user.id)) &&
          (
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.description && c.description.toLowerCase().includes(q)) ||
            (c.lastivkaId && matchLastivkaId(c.lastivkaId))
          )
      )
      channelResults = channelResults.map((c) => ({
        ...c,
        joined: isChannelMember(c, req.user.id),
      }))
    }

    if (filter === 'all' || filter === 'users') {
      userResults = users
        .filter((u) => u.id !== req.user.id)
        .filter((u) => (u.name && u.name.toLowerCase().includes(q)) || (u.lastivkaId && matchLastivkaId(u.lastivkaId)))
        .map((u) => ({ id: u.id, name: u.name, lastivkaId: u.lastivkaId || null }))
    }

    if (filter === 'all' || filter === 'messages') {
      messageResults = messages
        .filter((m) => m.text && m.text.toLowerCase().includes(q))
        .map((m) => ({
          ...m,
          chatKey:
            m.type === 'channel'
              ? m.channelId
              : m.type === 'discussion'
                ? `discussion-${m.channelId}`
                : `dm-${m.dmKey}`,
        }))
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 60)
    }
  }

  res.json({ channels: channelResults, users: userResults, messages: messageResults })
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist')
app.get('/api/status', (_req, res) => {
  res.json({ storage: process.env.DATABASE_URL ? 'postgresql' : 'json', hasDbUrl: !!process.env.DATABASE_URL })
})

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).end()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

;(async () => {
  try {
    await initStore()
  } catch (e) {
    console.error('Store init failed:', e.message)
    if (process.env.DATABASE_URL) console.error('Check neon-db.txt and Neon connection string')
  }
  app.listen(PORT, () => {
    console.log(process.env.DATABASE_URL ? `Ластівка — бекенд (PostgreSQL): http://localhost:${PORT}` : `Ластівка — бекенд: http://localhost:${PORT}`)
  })
})()
