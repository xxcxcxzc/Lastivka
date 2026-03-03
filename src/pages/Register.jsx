import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import * as api from '../api'
import styles from './Auth.module.css'

const ID_RE = /^[A-Za-z_-]+$/

export default function Register() {
  const [name, setName] = useState('')
  const [lastivkaId, setLastivkaId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useApp()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Паролі не збігаються.')
      return
    }
    if (password.length < 6) {
      setError('Пароль має бути не менше 6 символів.')
      return
    }
    if (lastivkaId.trim() && !ID_RE.test(lastivkaId.trim())) {
      setError('Lastivka-id: тільки англ. літери, - та _.')
      return
    }
    setLoading(true)
    try {
      const { user, token } = await api.auth.register({
        name: name.trim(),
        lastivkaId: lastivkaId.trim() || null,
        email: email.trim(),
        password,
      })
      setUser(user, token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Помилка реєстрації.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.logo}>🕊</span>
          <h1>Ластівка — Створення акаунту</h1>
          <p>Заповніть дані для реєстрації</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <label>
            Ім'я
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше ім'я"
              required
              disabled={loading}
            />
          </label>
          <label>
            Lastivka-id (необов'язково)
            <input
              type="text"
              value={lastivkaId}
              onChange={(e) => setLastivkaId(e.target.value)}
              placeholder="your_id"
              disabled={loading}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Мінімум 6 символів"
              required
              disabled={loading}
            />
          </label>
          <label>
            Підтвердіть пароль
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </label>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Реєстрація...' : 'Зареєструватися'}
          </button>
        </form>
        <p className={styles.footer}>
          Вже є акаунт? <Link to="/login">Увійти</Link>
        </p>
      </div>
    </div>
  )
}
