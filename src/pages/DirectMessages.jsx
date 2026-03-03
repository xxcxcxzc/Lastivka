import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import * as api from '../api'
import styles from './DirectMessages.module.css'

export default function DirectMessages() {
  const { user, dms, addDm } = useApp()
  const [users, setUsers] = useState([])
  const [newUserName, setNewUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    api.users.list().then((list) => { if (!cancelled) setUsers(list) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const startDm = async (otherUser) => {
    const existing = dms.find((d) => d.userId === otherUser.id)
    if (existing) {
      navigate(`/dm/${otherUser.id}`)
      return
    }
    setLoading(true)
    try {
      const partner = await addDm({ userId: otherUser.id })
      navigate(`/dm/${partner.userId}`)
    } catch (_) {}
    setLoading(false)
  }

  const startDmByName = async (e) => {
    e.preventDefault()
    const name = newUserName.trim()
    if (!name) return
    setLoading(true)
    try {
      const partner = await addDm({ userName: name })
      setNewUserName('')
      navigate(`/dm/${partner.userId}`)
    } catch (err) {
      setNewUserName('')
    }
    setLoading(false)
  }

  const dmPartnerIds = new Set(dms.map((d) => d.userId))
  const contacts = [...dms.map((d) => ({ id: d.userId, name: d.userName })), ...users.filter((u) => !dmPartnerIds.has(u.id))]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Особисті повідомлення</h1>
        <p>Приватні діалоги — тільки ви та ваш співрозмовник</p>
      </div>
      <form onSubmit={startDmByName} className={styles.newDm}>
        <input
          type="text"
          value={newUserName}
          onChange={(e) => setNewUserName(e.target.value)}
          placeholder="Ім'я нового контакту або почати діалог"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>Почати діалог</button>
      </form>
      <section className={styles.section}>
        <h2>Контакти та діалоги</h2>
        <ul className={styles.list}>
          {contacts
            .filter((u) => u.id !== user?.id)
            .map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className={styles.contactCard}
                  onClick={() => startDm(u)}
                  disabled={loading}
                >
                  <span className={styles.avatar}>{u.name.charAt(0).toUpperCase()}</span>
                  <span className={styles.contactName}>{u.name}</span>
                  <span className={styles.open}>Відкрити</span>
                </button>
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}
