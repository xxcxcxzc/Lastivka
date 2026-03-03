import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import * as api from '../api'
import styles from './CreateChannel.module.css'

const ID_RE = /^[A-Za-z_-]+$/

export default function CreateChannel() {
  const [name, setName] = useState('')
  const [lastivkaId, setLastivkaId] = useState('')
  const [kind, setKind] = useState('channel')
  const [visibility, setVisibility] = useState('public')
  const [avatar, setAvatar] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [users, setUsers] = useState([])
  const [step, setStep] = useState(1)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { addChannel } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    api.users.list().then(setUsers).catch(() => setUsers([]))
  }, [])

  const canGoNext = useMemo(() => {
    if (step === 1) return true
    if (step === 2) return true
    if (step === 3) return true
    return true
  }, [step])

  const onAvatarPick = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      setAvatar(value)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const trimmed = name.trim()
      const lid = lastivkaId.trim()
      if (!trimmed) throw new Error('Введіть назву каналу/групи.')
      if (visibility === 'public') {
        if (!lid) throw new Error('Lastivka-id обовʼязковий для публічного каналу/групи.')
        if (!ID_RE.test(lid)) throw new Error('Lastivka-id: тільки англ. літери, - та _.')
      }

      setLoading(true)
      const ch = await addChannel({
        name: trimmed,
        description: description.trim(),
        kind,
        visibility,
        avatar: avatar || null,
        memberIds: selectedUserIds,
        lastivkaId: visibility === 'public' ? lid : null,
      })
      navigate(`/channels/${ch.id}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Помилка створення.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1>Створення</h1>
        <p className={styles.subtitle}>Майстер створення у стилі Telegram</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.steps}>Крок {step} з 4</div>

          {step === 1 && (
            <>
              <label>
                Тип
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="channel">Канал</option>
                  <option value="group">Група</option>
                </select>
              </label>
            </>
          )}

          {step === 2 && (
            <label>
              Видимість
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="public">Публічний</option>
                <option value="private">Приватний</option>
              </select>
            </label>
          )}

          {step === 3 && (
            <label>
              Додати користувачів автоматично
              <div className={styles.userList}>
                {users.map((u) => (
                  <label key={u.id} className={styles.userItem}>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={(e) => {
                        setSelectedUserIds((prev) =>
                          e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        )
                      }}
                    />
                    <span>{u.name}{u.lastivkaId ? ` · @${u.lastivkaId}` : ''}</span>
                  </label>
                ))}
                {users.length === 0 && <div className={styles.emptyUsers}>Немає доступних користувачів</div>}
              </div>
            </label>
          )}

          {step === 4 && (
            <>
              <label>
                Назва *
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Назва" maxLength={100} />
              </label>
              <label>
                Опис
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Короткий опис" rows={3} />
              </label>
              <label>
                Аватар (файл, за бажанням)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onAvatarPick(e.target.files?.[0])}
                />
              </label>
              {avatar && <img src={avatar} alt="Аватар каналу" className={styles.avatarPreview} />}
              {visibility === 'public' ? (
                <label>
                  Lastivka-id *
                  <input type="text" value={lastivkaId} onChange={(e) => setLastivkaId(e.target.value)} placeholder="example_id" />
                </label>
              ) : (
                <div className={styles.privateNote}>Для приватного каналу/групи створиться приватне посилання (видиме адміну в керуванні каналом).</div>
              )}
            </>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={() => navigate('/channels')} disabled={loading}>Скасувати</button>
            {step > 1 && (
              <button type="button" className={styles.cancel} onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={loading}>Назад</button>
            )}
            {step < 4 ? (
              <button type="button" className={styles.submit} onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={loading || !canGoNext}>Далі</button>
            ) : (
              <button type="submit" className={styles.submit} disabled={loading}>{loading ? 'Створення...' : 'Створити'}</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
