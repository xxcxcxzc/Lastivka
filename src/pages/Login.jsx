import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import * as api from '../api'
import styles from './Auth.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useApp()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, token } = await api.auth.login({ email, password })
      setUser(user, token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Невірний email або пароль.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.logo}>🕊</span>
          <h1>Ластівка</h1>
          <p>Увійдіть у свій акаунт</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
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
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </label>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
        <p className={styles.footer}>
          Немає акаунту? <Link to="/register">Зареєструватися</Link>
        </p>
      </div>
    </div>
  )
}
