import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import * as api from '../api'
import styles from './Admin.module.css'

export default function Admin() {
  const { user, channels, refreshChannels } = useApp()
  const [selectedChannel, setSelectedChannel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const myChannels = channels.filter((c) => c.members?.includes(user?.id))

  const handleGrant = async () => {
    if (!selectedChannel) return
    setLoading(true)
    setError('')
    try {
      await api.admin.setChannelOfficial(selectedChannel, true)
      await refreshChannels?.()
      setSelectedChannel('')
    } catch (e) {
      setError(e.message || 'Не вдалося видати офіційність')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!selectedChannel) return
    setLoading(true)
    setError('')
    try {
      await api.admin.setChannelOfficial(selectedChannel, false)
      await refreshChannels?.()
      setSelectedChannel('')
    } catch (e) {
      setError(e.message || 'Не вдалося забрати офіційність')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Адмін-панель</h1>
      <p className={styles.desc}>Офіційність каналу (✓ Офіційне ластівка-джерело)</p>

      <div className={styles.section}>
        <h3>Видати офіційність</h3>
        <select
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          className={styles.select}
        >
          <option value="">Оберіть канал</option>
          {myChannels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.official ? '✓' : ''}
            </option>
          ))}
        </select>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleGrant}
            disabled={!selectedChannel || loading}
          >
            Видати
          </button>
          <button
            type="button"
            className={styles.btnRevoke}
            onClick={handleRevoke}
            disabled={!selectedChannel || loading}
          >
            Забрати
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.section}>
        <h3>Офіційні канали</h3>
        <ul className={styles.list}>
          {myChannels.filter((c) => c.official).length === 0 ? (
            <li className={styles.empty}>Немає офіційних каналів</li>
          ) : (
            myChannels
              .filter((c) => c.official)
              .map((c) => (
                <li key={c.id} className={styles.listItem}>
                  <span className={styles.officialBadge}>✓</span>
                  {c.name}
                  {c.lastivkaId && ` @${c.lastivkaId}`}
                </li>
              ))
          )}
        </ul>
      </div>
    </div>
  )
}
