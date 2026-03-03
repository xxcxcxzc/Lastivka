import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAlert } from '../context/AlertContext'
import * as api from '../api'
import styles from './Search.module.css'

export default function Search() {
  const { user, channels, joinChannel, leaveChannel, refreshChannels, refreshDialogs } = useApp()
  const { showAlert } = useAlert()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [channelResults, setChannelResults] = useState([])
  const [userResults, setUserResults] = useState([])
  const [messageResults, setMessageResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setChannelResults([])
      setUserResults([])
      setMessageResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    api.search.run(q, filter).then((data) => {
      if (!cancelled) {
        setChannelResults(data.channels || [])
        setUserResults(data.users || [])
        setMessageResults(data.messages || [])
      }
    }).catch(() => {
      if (!cancelled) {
        setChannelResults([])
        setUserResults([])
        setMessageResults([])
      }
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, filter])

  const showUsers = filter === 'all' || filter === 'users'
  const showChannels = filter === 'all' || filter === 'channels'
  const showMessages = filter === 'all' || filter === 'messages'

  const otherUserIdFromDmKey = (chatKey) => {
    if (!chatKey || !chatKey.startsWith('dm-')) return null
    const part = chatKey.replace('dm-', '')
    const ids = part.split('::')
    return ids.find((x) => x !== user?.id) || null
  }

  const joinedSet = new Set((channels || []).map((c) => c.id))

  const onJoinLeave = async (channelId, joined) => {
    try {
      setActionLoadingId(channelId)
      if (joined) await leaveChannel(channelId)
      else await joinChannel(channelId)
      await refreshChannels?.()
      await refreshDialogs?.()
    } catch (e) {
      showAlert(e.message || 'Не вдалося виконати дію')
    } finally {
      setActionLoadingId('')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Пошук</h1>
        <p>Знайдіть канали та повідомлення</p>
      </div>
      <div className={styles.searchBox}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Введіть запит..."
          autoFocus
        />
      </div>
      <div className={styles.filters}>
        <button
          type="button"
          className={filter === 'all' ? styles.filterActive : ''}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        <button
          type="button"
          className={filter === 'users' ? styles.filterActive : ''}
          onClick={() => setFilter('users')}
        >
          Користувачі
        </button>
        <button
          type="button"
          className={filter === 'channels' ? styles.filterActive : ''}
          onClick={() => setFilter('channels')}
        >
          Канали
        </button>
        <button
          type="button"
          className={filter === 'messages' ? styles.filterActive : ''}
          onClick={() => setFilter('messages')}
        >
          Повідомлення
        </button>
      </div>
      <div className={styles.results}>
        {showUsers && (
          <section className={styles.section}>
            <h2>Користувачі</h2>
            {!query.trim() ? (
              <p className={styles.hint}>Введіть ім'я або Lastivka-id</p>
            ) : loading ? (
              <p className={styles.hint}>Пошук...</p>
            ) : userResults.length === 0 ? (
              <p className={styles.empty}>Нічого не знайдено</p>
            ) : (
              <ul>
                {userResults.map((u) => (
                  <li key={u.id}>
                    <Link to={`/dm/${u.id}`} className={styles.resultCard}>
                      <span className={styles.chIcon}>{(u.name || '?').charAt(0).toUpperCase()}</span>
                      <div>
                        <strong>{u.name}</strong>
                        <span>{u.lastivkaId ? `@${u.lastivkaId}` : 'без-id'}</span>
                      </div>
                      <span className={styles.arrow}>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {showChannels && (
          <section className={styles.section}>
            <h2>Канали</h2>
            {!query.trim() ? (
              <p className={styles.hint}>Введіть запит для пошуку каналів</p>
            ) : loading ? (
              <p className={styles.hint}>Пошук...</p>
            ) : channelResults.length === 0 ? (
              <p className={styles.empty}>Нічого не знайдено</p>
            ) : (
              <ul>
                {channelResults.map((ch) => (
                  <li key={ch.id}>
                    <div className={styles.resultCard}>
                      <Link to={`/channels/${ch.id}`} className={styles.channelLink}>
                        {ch.avatar ? <img className={styles.chIconImg} src={ch.avatar} alt={ch.name} /> : <span className={styles.chIcon}>#</span>}
                        <div>
                          <strong>{ch.name}</strong>
                          <span>
                            {[ch.kind === 'group' ? 'Група' : 'Канал', ch.lastivkaId ? `@${ch.lastivkaId}` : null, ch.description || null]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                      </Link>
                      <button
                        type="button"
                        className={joinedSet.has(ch.id) ? styles.leaveBtn : styles.joinBtn}
                        disabled={actionLoadingId === ch.id}
                        onClick={() => onJoinLeave(ch.id, joinedSet.has(ch.id))}
                      >
                        {actionLoadingId === ch.id ? '...' : joinedSet.has(ch.id) ? 'Покинути' : 'Приєднатись'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {showMessages && (
          <section className={styles.section}>
            <h2>Повідомлення</h2>
            {!query.trim() ? (
              <p className={styles.hint}>Введіть запит для пошуку в тексті</p>
            ) : loading ? (
              <p className={styles.hint}>Пошук...</p>
            ) : messageResults.length === 0 ? (
              <p className={styles.empty}>Нічого не знайдено</p>
            ) : (
              <ul>
                {messageResults.slice(0, 30).map((msg) => (
                  <li key={msg.id}>
                    <div className={styles.msgCard}>
                      <span className={styles.msgMeta}>
                        {msg.authorName} · {new Date(msg.time).toLocaleString('uk-UA')}
                      </span>
                      <p className={styles.msgPreview}>{msg.text}</p>
                      {msg.chatKey?.startsWith('dm-') ? (
                        <Link to={`/dm/${otherUserIdFromDmKey(msg.chatKey)}`} className={styles.link}>
                          Відкрити діалог →
                        </Link>
                      ) : msg.chatKey?.startsWith('discussion-') ? (
                        <Link to={`/channels/${msg.chatKey.replace('discussion-', '')}/discussion`} className={styles.link}>
                          Відкрити обговорення →
                        </Link>
                      ) : (
                        <Link to={`/channels/${msg.chatKey}`} className={styles.link}>
                          Відкрити канал →
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
