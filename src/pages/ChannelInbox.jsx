import { useParams, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import styles from './ChannelInbox.module.css'

export default function ChannelInbox() {
  const { id } = useParams()
  const { user, channels, dialogs } = useApp()
  const channel = channels.find((c) => c.id === id)

  if (!channel || channel.ownerId !== user?.id) {
    return (
      <div className={styles.page}>
        <p>Немає доступу</p>
        <Link to="/channels">До каналів</Link>
      </div>
    )
  }

  const dmDialogs = dialogs.filter((d) => d.type === 'dm')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={`/channels/${id}`} className={styles.back}>← Канал</Link>
        <h1>Вхідні повідомлення · {channel.name}</h1>
        <p>Листи від користувачів каналу</p>
      </header>
      <div className={styles.list}>
        {dmDialogs.length === 0 ? (
          <p className={styles.empty}>Поки немає листів</p>
        ) : (
          dmDialogs.map((d) => (
            <Link key={d.key} to={`/dm/${d.id}`} className={styles.item}>
              {d.avatar ? (
                <img src={d.avatar} alt="" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatar}>{d.title?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
              <div className={styles.meta}>
                <strong>{d.title}</strong>
                <span>{d.subtitle || d.lastMessage || '...'}</span>
              </div>
              {d.unreadCount > 0 && <span className={styles.unread}>{d.unreadCount}</span>}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
