import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from '../api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUserState] = useState(null)
  const [channels, setChannels] = useState([])
  const [dms, setDms] = useState([])
  const [dialogs, setDialogs] = useState([])
  const [storage, setStorage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadUser = useCallback(async () => {
    const token = api.getToken()
    if (!token) {
      setUserState(null)
      setLoading(false)
      return
    }
    try {
      const { user: u } = await api.auth.me()
      setUserState(u)
    } catch {
      api.setToken(null)
      setUserState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadChannels = useCallback(async () => {
    if (!user) return
    try {
      const list = await api.channels.list()
      setChannels(list)
    } catch (e) {
      setError(e.message)
    }
  }, [user])

  const loadDms = useCallback(async () => {
    if (!user) return
    try {
      const list = await api.dms.list()
      setDms(list)
    } catch (e) {
      setError(e.message)
    }
  }, [user])

  const loadDialogs = useCallback(async () => {
    if (!user) return
    try {
      const data = await api.dialogs.list()
      const list = Array.isArray(data) ? data : (data.dialogs || [])
      setDialogs(list)
      if (data && !Array.isArray(data)) setStorage(data.storage || 'json')
    } catch (e) {
      setError(e.message)
    }
  }, [user])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  useEffect(() => {
    if (user) {
      loadChannels()
      loadDms()
      loadDialogs()
    } else {
      setChannels([])
      setDms([])
      setDialogs([])
    }
  }, [user, loadChannels, loadDms, loadDialogs])

  const setUser = (u, token) => {
    setUserState(u)
    if (token !== undefined) api.setToken(token || null)
  }

  const addChannel = async (channel) => {
    const created = await api.channels.create(channel)
    setChannels((prev) => [...prev, created])
    loadDialogs()
    return created
  }

  const updateChannel = async (id, body) => {
    const updated = await api.channels.update(id, body)
    setChannels((prev) => prev.map((c) => (c.id === id ? updated : c)))
    loadDialogs()
    return updated
  }

  const joinChannel = async (id) => {
    await api.channels.join(id)
    await loadChannels()
    await loadDialogs()
  }

  const leaveChannel = async (id) => {
    await api.channels.leave(id)
    await loadChannels()
    await loadDialogs()
  }

  const addDm = async (body) => {
    const partner = await api.dms.start(body)
    const exists = dms.some((d) => d.userId === partner.userId)
    if (!exists) setDms((prev) => [...prev, partner])
    loadDialogs()
    return partner
  }

  const getMessages = useCallback(
    async (chatId, mode = 'dm', postId = null) => {
      if (!user) return []
      try {
        if (mode === 'channel') return await api.channels.getMessages(chatId)
        if (mode === 'discussion') return await api.channels.getDiscussion(chatId, postId)
        return await api.dms.getMessages(chatId)
      } catch {
        return []
      }
    },
    [user]
  )

  const sendMessage = useCallback(
    async (chatId, text, mode = 'dm', postId = null, attachment = null) => {
      if (!user) return null
      try {
        if (mode === 'channel') return await api.channels.sendMessage(chatId, text, attachment)
        if (mode === 'discussion') return await api.channels.sendDiscussion(chatId, text, postId, attachment)
        return await api.dms.sendMessage(chatId, text, attachment)
      } catch (e) {
        setError(e.message)
        throw e
      }
    },
    [user]
  )

  const value = {
    user,
    setUser,
    channels,
    addChannel,
    updateChannel,
    joinChannel,
    leaveChannel,
    getChannelMembers: api.channels.getMembers,
    addChannelMember: api.channels.addMember,
    removeChannelMember: api.channels.removeMember,
    dms,
    addDm,
    dialogs,
    storage,
    refreshDialogs: loadDialogs,
    markDialogRead: api.dialogs.markRead,
    getMessages,
    sendMessage,
    updateMessage: api.messages.edit,
    deleteMessage: api.messages.remove,
    pinMessage: api.messages.pin,
    forwardMessage: api.messages.forward,
    addReaction: api.messages.reaction,
    updateProfile: async (body) => {
      const { user: next } = await api.auth.updateMe(body)
      setUserState(next)
      return next
    },
    loading,
    error,
    setError,
    refreshChannels: loadChannels,
    refreshDms: loadDms,
    updateUserPrefs: api.userPrefs.update,
    getUserPrefs: api.userPrefs.get,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
