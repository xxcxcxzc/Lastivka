const API = '/api'
const TOKEN_KEY = 'lastivka_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(`${API}${url}`, { ...options, headers, signal: controller.signal })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || res.statusText || 'Помилка мережі')
    return data
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Перевищено час очікування запиту')
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

async function withFallback(requests) {
  let lastError = null
  for (const run of requests) {
    try {
      return await run()
    } catch (e) {
      lastError = e
      const msg = (e?.message || '').toLowerCase()
      const isRouteIssue = msg.includes('not found') || msg.includes('cannot') || msg.includes('405')
      if (!isRouteIssue) throw e
    }
  }
  throw lastError || new Error('Помилка мережі')
}

export const auth = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  updateMe: (body) =>
    withFallback([
      () => request('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
      () => request('/auth/me/update', { method: 'POST', body: JSON.stringify(body) }),
      () => request('/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
      () => request('/auth/profile', { method: 'POST', body: JSON.stringify(body) }),
    ]),
  logout: () => request('/auth/logout', { method: 'POST' }),
}

export const channels = {
  list: () => request('/channels').then((r) => r.channels || []),
  create: (body) => request('/channels', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) =>
    withFallback([
      () => request(`/channels/${id}/update`, { method: 'POST', body: JSON.stringify(body) }),
      () => request(`/channels/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
      () => request(`/channels/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    ]),
  getMembers: (id) => request(`/channels/${id}/members`).then((r) => r.members || []),
  addMember: (id, userId) => request(`/channels/${id}/members`, { method: 'POST', body: JSON.stringify({ userId }) }),
  removeMember: (id, userId) =>
    withFallback([
      () => request(`/channels/${id}/members/${userId}/remove`, { method: 'POST' }),
      () => request(`/channels/${id}/members/${userId}`, { method: 'DELETE' }),
    ]),
  join: (id) => request(`/channels/${id}/join`, { method: 'POST' }),
  leave: (id) => request(`/channels/${id}/leave`, { method: 'POST' }),
  getMessages: (id) => request(`/channels/${id}/messages`).then((r) => r.messages || []),
  sendMessage: (id, text, attachment) => request(`/channels/${id}/messages`, { method: 'POST', body: JSON.stringify({ text, attachment }) }),
  getDiscussion: (id, parentId) =>
    request(`/channels/${id}/discussion${parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''}`).then((r) => r.messages || []),
  sendDiscussion: (id, text, parentMessageId, attachment) =>
    request(`/channels/${id}/discussion`, { method: 'POST', body: JSON.stringify({ text, parentMessageId: parentMessageId || null, attachment }) }),
}

export const users = {
  list: () => request('/users').then((r) => r.users || []),
}

export const dms = {
  list: () => request('/dms').then((r) => r.dms || []),
  start: (body) => request('/dms', { method: 'POST', body: JSON.stringify(body) }),
  getMessages: (userId) => request(`/dms/${userId}/messages`).then((r) => r.messages || []),
  sendMessage: (userId, text, attachment) => request(`/dms/${userId}/messages`, { method: 'POST', body: JSON.stringify({ text, attachment }) }),
}

export const dialogs = {
  list: () => request('/dialogs').then((r) => ({ dialogs: r.dialogs || [], storage: r.storage || 'json' })),
  markRead: (key) => request(`/dialogs/${encodeURIComponent(key)}/read`, { method: 'POST' }),
}

export const messages = {
  edit: (id, text) =>
    withFallback([
      () => request(`/messages/${id}/edit`, { method: 'POST', body: JSON.stringify({ text }) }),
      () => request(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
    ]),
  remove: (id, scope = 'self') =>
    withFallback([
      () => request(`/messages/${id}/remove`, { method: 'POST', body: JSON.stringify({ scope }) }),
      () => request(`/messages/${id}?scope=${scope}`, { method: 'DELETE' }),
      () => request(`/messages/${id}/delete`, { method: 'POST', body: JSON.stringify({ scope }) }),
    ]),
  pin: (id) => request(`/messages/${id}/pin`, { method: 'POST' }),
  reaction: (id, emoji) => request(`/messages/${id}/reaction`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  forward: (id, targetType, targetId) => request(`/messages/${id}/forward`, { method: 'POST', body: JSON.stringify({ targetType, targetId }) }),
}

export const search = {
  run: (q, filter = 'all') => request(`/search?q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filter)}`),
}

export const feed = {
  popular: () => request('/feed/popular').then((r) => r.posts || []),
  byKeywords: (keywordsStr) =>
    request(`/feed/keywords?keywords=${encodeURIComponent(keywordsStr || '')}`).then((r) => r.messages || []),
}

export const messageViews = {
  record: (id) => request(`/messages/${id}/view`, { method: 'POST' }),
  recordBatch: (messageIds) => request('/messages/views', { method: 'POST', body: JSON.stringify({ messageIds }) }),
}

export const admin = {
  setChannelOfficial: (channelId, official) =>
    request(`/admin/channels/${channelId}/official`, { method: 'PATCH', body: JSON.stringify({ official }) }),
}

export const userPrefs = {
  get: () => request('/user-prefs').then((r) => r || { pinned: [], muted: {}, notifications: {} }),
  update: (body) => request('/user-prefs', { method: 'PATCH', body: JSON.stringify(body) }),
}
