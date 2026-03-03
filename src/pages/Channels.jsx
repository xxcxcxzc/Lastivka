import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import styles from './Channels.module.css'

export default function Channels() {
  const { dialogs } = useApp()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Діалоги</h1>
      </div>
      {dialogs.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>💬</span>
          <p>Немає чатів</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {dialogs.map((d) => (
            <li key={d.key}>
              <div className={styles.channelCard}>
                <Link to={d.type === 'dm' ? `/dm/${d.id}` : d.type === 'discussion' ? `/channels/${d.id}/discussion` : `/channels/${d.id}`} className={styles.channelMain}>
                  <span className={styles.channelIcon}>#</span>
                  <div className={styles.channelInfo}>
                    <strong>{d.title}</strong>
                    <span>{d.lastMessage || d.subtitle || '...'}</span>
                  </div>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
