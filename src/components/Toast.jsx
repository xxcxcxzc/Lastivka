import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Toast.module.css'

export default function Toast({ id, dialogKey, title, subtitle, text, avatar, onClose }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true)
      setTimeout(onClose, 400)
    }, 10000)
    return () => clearTimeout(t)
  }, [onClose])

  let href = '/channels'
  if (dialogKey) {
    if (dialogKey.startsWith('dm:')) {
      const parts = dialogKey.replace('dm:', '').split('::')
      const otherId = parts.find((p) => p) || parts[0]
      if (otherId) href = `/dm/${otherId}`
    } else if (dialogKey.startsWith('channel:')) {
      href = `/channels/${dialogKey.replace('channel:', '')}`
    } else if (dialogKey.startsWith('discussion:')) {
      href = `/channels/${dialogKey.replace('discussion:', '')}/discussion`
    }
  }

  return (
    <div className={`${styles.toast} ${exiting ? styles.toastExiting : ''}`} onClick={() => { setExiting(true); setTimeout(onClose, 400) }} data-exiting={exiting || undefined}>
      <Link to={href} className={styles.link} onClick={(e) => e.stopPropagation()}>
        <div className={styles.avatar}>
          {avatar ? <img src={avatar} alt="" /> : <span>{(title || '?').charAt(0).toUpperCase()}</span>}
        </div>
        <div className={styles.content}>
          <div className={styles.title}>{(title || '').slice(0, 40)}{(title || '').length > 40 ? '…' : ''}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          {text && <div className={styles.text}>{(text || '').slice(0, 80)}{(text || '').length > 80 ? '…' : ''}</div>}
        </div>
      </Link>
    </div>
  )
}
