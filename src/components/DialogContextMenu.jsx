import { useEffect } from 'react'
import styles from './DialogContextMenu.module.css'

export default function DialogContextMenu({ x, y, dialog, canLeave, onClose, onPin, onLeave, onMute, onNotifications }) {
  useEffect(() => {
    const h = () => onClose()
    window.addEventListener('click', h)
    window.addEventListener('scroll', h, true)
    return () => {
      window.removeEventListener('click', h)
      window.removeEventListener('scroll', h, true)
    }
  }, [onClose])

  return (
    <div className={styles.menu} style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => { onPin(); onClose(); }}>
        {dialog?.pinned ? '📌 Відкріпити' : '📌 Закріпити зверху'}
      </button>
      {canLeave && (
        <button type="button" onClick={() => { onLeave(); onClose(); }}>
          🚪 Покинути
        </button>
      )}
      <button type="button" onClick={() => { onMute(); onClose(); }}>
        {dialog?.muted ? '🔔 Увімкнути звук' : '🔕 Вимкнути звук'}
      </button>
      <button type="button" onClick={() => { onNotifications(); onClose(); }}>
        {dialog?.notifications === false ? '🔔 Увімкнути сповіщення' : '🔕 Вимкнути сповіщення'}
      </button>
    </div>
  )
}
