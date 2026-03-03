import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import * as api from '../api'
import styles from './Layout.module.css'
import DialogContextMenu from './DialogContextMenu'

const ADMIN_LASTIVKA_ID = 'moon'

export default function Layout() {
  const { user, setUser, dialogs, channels, dms, refreshDialogs, refreshChannels, refreshDms, updateUserPrefs, leaveChannel } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [contextMenu, setContextMenu] = useState(null)

  const isAdmin = user?.lastivkaId?.toLowerCase() === ADMIN_LASTIVKA_ID

  useEffect(() => {
    refreshDialogs?.()
    refreshChannels?.()
    refreshDms?.()
  }, [refreshDialogs, refreshChannels, refreshDms])

  const sidebarItems =
    dialogs.length > 0
      ? dialogs
      : [
          ...channels.map((c) => ({
            key: `channel:${c.id}`,
            type: 'channel',
            id: c.id,
            title: c.name,
            subtitle: c.lastivkaId ? `@${c.lastivkaId}` : c.description || '',
            lastMessage: '',
            unreadCount: 0,
            avatar: c.avatar || null,
            official: !!c.official,
          })),
          ...dms.map((d) => ({
            key: `dm-fallback:${d.userId}`,
            type: 'dm',
            id: d.userId,
            title: d.userName || 'Користувач',
            subtitle: d.lastivkaId ? `@${d.lastivkaId}` : '',
            lastMessage: '',
            unreadCount: 0,
            avatar: d.avatar || null,
            official: false,
          })),
        ]

  const handleContextMenu = useCallback((e, d) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, dialog: d })
  }, [])

  const updatePrefs = useCallback(async (updates) => {
    try {
      const current = await api.userPrefs.get()
      await updateUserPrefs?.({ ...current, ...updates })
      refreshDialogs?.()
    } catch (_) {}
  }, [updateUserPrefs, refreshDialogs])

  const handlePin = useCallback(async () => {
    if (!contextMenu?.dialog) return
    const d = contextMenu.dialog
    const current = await api.userPrefs.get()
    const pinned = current.pinned || []
    const isPinned = pinned.includes(d.key)
    if (isPinned) {
      await updatePrefs({ pinned: pinned.filter((k) => k !== d.key) })
    } else if (pinned.length < 4) {
      await updatePrefs({ pinned: [d.key, ...pinned.filter((k) => k !== d.key)] })
    }
  }, [contextMenu, updatePrefs])

  const handleLeave = useCallback(async () => {
    if (!contextMenu?.dialog) return
    const d = contextMenu.dialog
    const ch = (d.type === 'channel' || d.type === 'discussion') ? channels.find((c) => c.id === d.id) : null
    if (ch && ch.ownerId !== user?.id) {
      try {
        await leaveChannel?.(d.id)
        navigate('/channels')
        refreshDialogs?.()
      } catch (_) {}
    }
    setContextMenu(null)
  }, [contextMenu, channels, user, leaveChannel, navigate, refreshDialogs])

  const handleMute = useCallback(async () => {
    if (!contextMenu?.dialog) return
    const d = contextMenu.dialog
    const current = await api.userPrefs.get()
    const muted = { ...(current.muted || {}) }
    muted[d.key] = !d.muted
    await updatePrefs({ muted })
  }, [contextMenu, updatePrefs])

  const handleNotifications = useCallback(async () => {
    if (!contextMenu?.dialog) return
    const d = contextMenu.dialog
    const current = await api.userPrefs.get()
    const notifications = { ...(current.notifications || {}) }
    notifications[d.key] = d.notifications === false
    await updatePrefs({ notifications })
  }, [contextMenu, updatePrefs])

  const handleLogout = async () => {
    try {
      await api.auth.logout()
    } catch (_) {}
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <img src="/logo/LastiVka.svg" alt="Ластівка" className={styles.logoImage} />
          <span>Ластівка</span>
          <Link to="/search" className={styles.searchTopBtn} title="Пошук користувачів, каналів і груп">
            🔎
          </Link>
          <Link to="/channels/new" className={styles.createTopBtn} title="Створити канал/групу">
            ✎
          </Link>
        </div>

        <div className={`${styles.dialogList} ${sidebarItems.length === 0 && !isAdmin ? styles.dialogListEmpty : ''}`}>
          {isAdmin && (
            <Link to="/admin" className={`${styles.dialogItem} ${location.pathname === '/admin' ? styles.dialogItemActive : ''} ${styles.adminItem}`}>
              <span className={styles.dialogAvatar}>⚙</span>
              <span className={styles.dialogMeta}>
                <span className={styles.dialogTitle}>Адмін-панель</span>
                <span className={styles.dialogSub}>@moon</span>
              </span>
            </Link>
          )}
          {sidebarItems.length === 0 && !isAdmin ? (
            <div className={styles.empty}>Немає чатів</div>
          ) : (
            sidebarItems.map((d) => {
              const to = d.type === 'dm' ? `/dm/${d.id}` : d.type === 'discussion' ? `/channels/${d.id}/discussion` : `/channels/${d.id}`
              const active = location.pathname === to || (d.type === 'discussion' && location.pathname.startsWith(`/channels/${d.id}/discussion`))
              return (
                <Link
                  key={d.key}
                  to={to}
                  className={`${styles.dialogItem} ${active ? styles.dialogItemActive : ''} ${d.muted ? styles.dialogMuted : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, d)}
                >
                  {d.avatar ? (
                    <img src={d.avatar} alt="" className={styles.dialogAvatarImg} />
                  ) : (
                    <span className={styles.dialogAvatar}>{(d.title || '?').charAt(0).toUpperCase()}</span>
                  )}
                  <span className={styles.dialogMeta}>
                    <span className={styles.dialogTitle}>
                      {d.title}
                      {d.official && <span className={styles.officialBadge} title="Офіційне ластівка-джерело">✓</span>}
                    </span>
                    <span className={styles.dialogSub}>{d.lastMessage || d.subtitle || '...'}</span>
                  </span>
                  {d.unreadCount > 0 && !d.muted && <span className={styles.dialogUnread}>{d.unreadCount}</span>}
                  {d.muted && <span className={styles.mutedIcon} title="Звук вимкнено">🔕</span>}
                </Link>
              )
            })
          )}
        </div>

        {contextMenu && (
          <DialogContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            dialog={contextMenu.dialog}
            canLeave={
              (contextMenu.dialog?.type === 'channel' || contextMenu.dialog?.type === 'discussion') &&
              channels.find((c) => c.id === contextMenu.dialog?.id)?.ownerId !== user?.id
            }
            onClose={() => setContextMenu(null)}
            onPin={handlePin}
            onLeave={handleLeave}
            onMute={handleMute}
            onNotifications={handleNotifications}
          />
        )}

        <div className={styles.userBlock}>
          <div className={styles.userAvatar}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name || 'Користувач'}</span>
            <span className={styles.userId}>{user?.lastivkaId ? `@${user.lastivkaId}` : '@без-id'}</span>
            <div className={styles.userActions}>
              <Link to="/settings" className={styles.settingsBtn}>⚙ Керування</Link>
              <button type="button" className={styles.logoutBtn} onClick={handleLogout}>Вийти</button>
            </div>
          </div>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
