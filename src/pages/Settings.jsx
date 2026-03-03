import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import styles from './Settings.module.css'

const ID_RE = /^[A-Za-z_-]+$/

export default function Settings() {
  const { user, updateProfile } = useApp()
  const [name, setName] = useState(user?.name || '')
  const [lastivkaId, setLastivkaId] = useState(user?.lastivkaId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const { storage } = useApp()

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    if (!name.trim()) return setError("Вкажіть ім'я.")
    if (lastivkaId.trim() && !ID_RE.test(lastivkaId.trim())) {
      return setError('Lastivka-id: тільки англ. літери, - та _.')
    }
    setSaving(true)
    try {
      await updateProfile({ name: name.trim(), lastivkaId: lastivkaId.trim() || null })
      setOk('Профіль оновлено.')
    } catch (e2) {
      const msg = e2.message || ''
      if (msg.toLowerCase().includes('not found')) {
        setError('Не вдалося знайти API оновлення профілю. Перезапустіть Ластівку або оновіть інсталятор.')
      } else {
        setError(msg || 'Не вдалося зберегти зміни.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Налаштування</h1>
        <p>Керуйте профілем та конфіденційністю</p>
      </div>
      <section className={styles.section}>
        <h2>Керування акаунтом</h2>
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className={styles.profileInfo}>
            <strong>{user?.name || 'Користувач'}</strong>
            <span>{user?.lastivkaId ? `@${user.lastivkaId}` : '@без-id'}</span>
            <span>{user?.email || '—'}</span>
          </div>
        </div>
        <form className={styles.card} onSubmit={save}>
          {error && <p className={styles.err}>{error}</p>}
          {ok && <p className={styles.ok}>{ok}</p>}
          <p><strong>Нік</strong></p>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          <p><strong>Lastivka-id</strong> (щоб вас могли знайти у пошуку)</p>
          <input className={styles.input} type="text" autoComplete="off" value={lastivkaId} onChange={(e) => setLastivkaId(e.target.value)} placeholder="your_id" disabled={saving} />
          <button className={styles.saveBtn} type="submit" disabled={saving}>{saving ? 'Збереження...' : 'Зберегти'}</button>
        </form>
      </section>
      <section className={styles.section}>
        <h2>Конфіденційність</h2>
        <div className={styles.card}>
          <p>
            <strong>Локальне зберігання</strong> — усі ваші повідомлення, канали та дані зберігаються лише на вашому пристрої в браузері. Ніхто інший не має доступу до них.
          </p>
          <p>
            Дані не передаються на зовнішні сервери. Додаток працює повністю офлайн після першого завантаження.
          </p>
        </div>
      </section>
      <section className={styles.section}>
        <h2>Підключення</h2>
        <div className={styles.card}>
          {storage === 'postgresql' ? (
            <p className={styles.ok}><strong>База: хмара (Neon)</strong> — усі користувачі спільні, пошук працює між ПК.</p>
          ) : storage === 'json' ? (
            <p className={styles.dbLocal}><strong>База: локальна</strong> — дані тільки на цьому ПК. Щоб бачити інших: додайте neon-db.txt з connection string з Neon.tech.</p>
          ) : (
            <p className={styles.dbLocal}><strong>База:</strong> завантаження...</p>
          )}
        </div>
      </section>
      <section className={styles.section}>
        <h2>Про додаток</h2>
        <div className={styles.card}>
          <p><strong>Ластівка</strong> — месенджер у стилі Telegram/Discord. Українська мова, темна тема, зручні розділи: канали, особисті повідомлення, пошук.</p>
          <p className={styles.version}>Версія 1.0</p>
        </div>
      </section>
    </div>
  )
}
