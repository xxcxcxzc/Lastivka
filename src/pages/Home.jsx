import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import styles from './Home.module.css'

export default function Home() {
  const { user, channels, dms } = useApp()

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1>Вітаємо, {user?.name || 'Користувач'}!</h1>
        <p>Оберіть розділ з меню або швидкі дії нижче.</p>
      </div>
      <div className={styles.quickActions}>
        <Link to="/channels/new" className={styles.card}>
          <span className={styles.cardIcon}>📢</span>
          <h3>Створити канал</h3>
          <p>Створіть новий канал для спілкування</p>
        </Link>
        <Link to="/channels" className={styles.card}>
          <span className={styles.cardIcon}>📋</span>
          <h3>Мої канали</h3>
          <p>Каналів: {channels.length}</p>
        </Link>
        <Link to="/dm" className={styles.card}>
          <span className={styles.cardIcon}>💬</span>
          <h3>Особисті повідомлення</h3>
          <p>Діалогів: {dms.length}</p>
        </Link>
        <Link to="/search" className={styles.card}>
          <span className={styles.cardIcon}>🔍</span>
          <h3>Пошук</h3>
          <p>Знайти канали та повідомлення</p>
        </Link>
      </div>
      <div className={styles.info}>
        <h3>🔒 Конфіденційність</h3>
        <p>Повідомлення зберігаються локально на вашому пристрої. Ви повністю контролюєте свої дані.</p>
      </div>
    </div>
  )
}
