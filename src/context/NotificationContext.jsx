import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import * as api from '../api'
import { useApp } from './AppContext'
import Toast from '../components/Toast'

const NotificationContext = createContext(null)

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch (_) {}
}

export function NotificationProvider({ children }) {
  const { user } = useApp()
  const [toasts, setToasts] = useState([])
  const prevDialogsRef = useRef({})
  const pollRef = useRef(null)

  const addToast = useCallback(({ title, subtitle, text, avatar, dialogKey }) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, title, subtitle, text, avatar, dialogKey }])
    playNotificationSound()
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!user) return

    const poll = async () => {
      try {
        const data = await api.dialogs.list()
        const dialogs = Array.isArray(data) ? data : (data?.dialogs || [])
        const prev = prevDialogsRef.current

        dialogs.forEach((d) => {
          if (d.notifications === false) return
          const prevD = prev[d.key]
          const prevTime = prevD?.lastMessageAt ? new Date(prevD.lastMessageAt).getTime() : 0
          const currTime = d.lastMessageAt ? new Date(d.lastMessageAt).getTime() : 0
          if (currTime > prevTime && d.unreadCount > 0) {
            addToast({
              title: d.title,
              subtitle: d.subtitle || '',
              text: d.lastMessage || '',
              avatar: d.avatar,
              dialogKey: d.key,
            })
          }
        })

        prevDialogsRef.current = Object.fromEntries(dialogs.map((d) => [d.key, d]))
      } catch (_) {}
    }

    poll()
    pollRef.current = setInterval(poll, 4000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [user, addToast])

  return (
    <NotificationContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            id={t.id}
            dialogKey={t.dialogKey}
            title={t.title}
            subtitle={t.subtitle}
            text={t.text}
            avatar={t.avatar}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  return ctx
}
