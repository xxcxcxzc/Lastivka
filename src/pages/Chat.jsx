import { useParams, Link } from 'react-router-dom'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAlert } from '../context/AlertContext'
import * as api from '../api'
import styles from './Chat.module.css'

const ID_RE = /^[A-Za-z_-]+$/

export default function Chat({ mode = 'dm' }) {
  const { id, userId, postId } = useParams()
  const {
    user,
    channels,
    updateChannel,
    getChannelMembers,
    addChannelMember,
    removeChannelMember,
    refreshChannels,
    dialogs,
    refreshDialogs,
    markDialogRead,
    getMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    pinMessage,
    forwardMessage,
    addReaction,
  } = useApp()
  const { showAlert } = useAlert()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const [manageSaving, setManageSaving] = useState(false)
  const [manageForm, setManageForm] = useState({ name: '', description: '', lastivkaId: '' })
  const [members, setMembers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [manageError, setManageError] = useState('')
  const [visibilityModal, setVisibilityModal] = useState(false)
  const [visibilityLastivkaId, setVisibilityLastivkaId] = useState('')
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteUserId, setInviteUserId] = useState('')
  const [editModal, setEditModal] = useState(null)
  const [editText, setEditText] = useState('')
  const [forwardModal, setForwardModal] = useState(null)
  const [forwardTarget, setForwardTarget] = useState('')
  const [reactionPicker, setReactionPicker] = useState(null)
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [animatingMessages, setAnimatingMessages] = useState(false)
  const prevChatKeyRef = useRef(null)
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👎', '🔥', '👏']
  const fileInputRef = useRef(null)
  const listRef = useRef(null)

  const onAttachmentPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const isImage = file.type.startsWith('image/')
      const isAudio = file.type.startsWith('audio/')
      setPendingAttachment({ type: isImage ? 'image' : isAudio ? 'audio' : 'file', data: reader.result, name: file.name })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const isChannel = mode === 'channel'
  const isDiscussion = mode === 'discussion'
  const channelId = id
  const discussionPostId = isDiscussion ? postId : null
  const channel = isChannel || isDiscussion ? channels.find((c) => c.id === channelId) : null
  const otherUserId = mode === 'dm' ? userId : null
  const currentChatKey = `${mode}:${channelId || otherUserId || ''}:${postId || ''}`

  const dialogKey = useMemo(() => {
    if (!user) return null
    if (isChannel) return `channel:${channelId}`
    if (isDiscussion) return postId ? `discussion:${channelId}:${postId}` : `discussion:${channelId}`
    if (!otherUserId) return null
    return `dm:${[user.id, otherUserId].sort().join('::')}`
  }, [user, isChannel, isDiscussion, channelId, otherUserId, postId])

  const activeDialog = useMemo(() => dialogs.find((d) => d.key === dialogKey), [dialogs, dialogKey])

  const canManageChannel = !!(channel && user && (channel.ownerId === user.id || !channel.ownerId))

  useEffect(() => {
    refreshDialogs?.()
  }, [refreshDialogs])

  useEffect(() => {
    let cancelled = false
    const chatId = isChannel || isDiscussion ? channelId : otherUserId
    if (!chatId) {
      setMessages([])
      setLoading(false)
      setShowLoadingOverlay(false)
      return
    }

    const isChannelSwitch = prevChatKeyRef.current !== null && prevChatKeyRef.current !== currentChatKey
    prevChatKeyRef.current = currentChatKey

    if (isChannelSwitch) {
      setShowLoadingOverlay(true)
    }

    setLoading(true)
    const loadStart = Date.now()
    getMessages(chatId, mode, discussionPostId)
      .then((list) => {
        if (!cancelled) {
          setMessages(list || [])
        }
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          if (isChannelSwitch) {
            const elapsed = Date.now() - loadStart
            const remaining = Math.max(0, 1000 - elapsed)
            setTimeout(() => {
              if (!cancelled) {
                setShowLoadingOverlay(false)
                setAnimatingMessages(true)
              }
            }, remaining)
          } else {
            setShowLoadingOverlay(false)
          }
        }
      })

    if (dialogKey) {
      markDialogRead?.(dialogKey).finally(() => refreshDialogs?.())
    }

    return () => {
      cancelled = true
    }
  }, [mode, isChannel, isDiscussion, channelId, otherUserId, discussionPostId, currentChatKey, getMessages, dialogKey, markDialogRead, refreshDialogs])

  useEffect(() => {
    if (!showLoadingOverlay && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length, showLoadingOverlay])

  useEffect(() => {
    if (!animatingMessages) return
    const t = setTimeout(() => setAnimatingMessages(false), 800)
    return () => clearTimeout(t)
  }, [animatingMessages])

  useEffect(() => {
    let cancelled = false
    if (!(isChannel || isDiscussion) || !channelId) return
    Promise.all([
      getChannelMembers(channelId).catch(() => []),
      api.users.list().catch(() => []),
    ]).then(([m, u]) => {
      if (!cancelled) {
        setMembers(m || [])
        setAllUsers(u || [])
      }
    })
    return () => {
      cancelled = true
    }
  }, [isChannel, isDiscussion, channelId, getChannelMembers])

  const handleSend = async (e) => {
    e.preventDefault()
    const text = input.trim()
    const chatId = isChannel || isDiscussion ? channelId : otherUserId
    if ((!text && !pendingAttachment) || !chatId) return
    setSending(true)
    const att = pendingAttachment
    setPendingAttachment(null)
    setInput('')
    try {
      const msg = await sendMessage(chatId, text, mode, discussionPostId, att)
      if (msg) {
        setMessages((prev) => [...prev, msg])
        refreshDialogs?.()
      } else {
        showAlert('Не вдалося надіслати повідомлення')
      }
    } catch (e2) {
      showAlert(e2.message || 'Не вдалося надіслати повідомлення')
      setInput(text)
      if (att) setPendingAttachment(att)
    } finally {
      setSending(false)
    }
  }

  const onEdit = async (msg) => {
    setEditModal(msg)
    setEditText(msg.text)
  }

  const onEditSubmit = async () => {
    if (!editModal || !editText.trim()) return
    try {
      const updated = await updateMessage(editModal.id, editText.trim())
      setMessages((prev) => prev.map((m) => (m.id === editModal.id ? { ...m, ...updated } : m)))
      refreshDialogs?.()
      setEditModal(null)
    } catch (e) {
      showAlert(e.message || 'Не вдалося відредагувати')
    }
  }

  const onDelete = async (msg, scope) => {
    setDeleteError('')
    const target = deleteTarget
    setDeleteTarget(null)
    setDeletingId(msg.id)
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _deleting: true } : m)))
    setTimeout(async () => {
      try {
        await deleteMessage(msg.id, scope)
        setMessages((prev) => prev.filter((m) => m.id !== msg.id))
        refreshDialogs?.()
      } catch (e) {
        setDeleteError(e.message || 'Не вдалося видалити. Перезапустіть Ластівку.')
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _deleting: false } : m)))
        setDeleteTarget(target)
      } finally {
        setDeletingId(null)
      }
    }, 400)
  }

  const onPin = async (msg) => {
    try {
      await pinMessage(msg.id)
      showAlert('Повідомлення закріплено')
    } catch (e) {
      showAlert(e.message || 'Не вдалося закріпити')
    }
  }

  const onForward = (msg) => {
    setForwardModal(msg)
    setForwardTarget(dialogs[0]?.key || '')
  }

  const onReaction = async (msgId, emoji) => {
    try {
      const { reactions } = await addReaction(msgId, emoji)
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: reactions || {} } : m)))
      setReactionPicker(null)
    } catch (e) {
      showAlert(e.message || 'Не вдалося додати реакцію')
    }
  }

  const onForwardSubmit = async () => {
    if (!forwardModal || !forwardTarget.trim()) return
    const target = forwardTarget.trim()
    try {
      if (target.startsWith('dm:')) {
        const dmPart = target.replace('dm:', '')
        const ids = dmPart.split('::').filter(Boolean)
        const other = ids.find((x) => x !== user?.id) || ids[0]
        if (!other) {
          showAlert('Невірний формат dm')
          return
        }
        await forwardMessage(forwardModal.id, 'dm', other)
      } else if (target.startsWith('channel:')) {
        await forwardMessage(forwardModal.id, 'channel', target.replace('channel:', ''))
      } else if (target.startsWith('discussion:')) {
        await forwardMessage(forwardModal.id, 'discussion', target.replace('discussion:', ''))
      } else {
        showAlert('Формат: dm:<userId> або channel:<channelId> або discussion:<channelId>')
        return
      }
      refreshDialogs?.()
      setForwardModal(null)
      showAlert('Переслано')
    } catch (e) {
      showAlert(e.message || 'Не вдалося переслати')
    }
  }

  const onManageChannel = async () => {
    if (!channel || !canManageChannel) return
    setManageError('')
    setManageForm({
      name: channel.name || '',
      description: channel.description || '',
      lastivkaId: channel.lastivkaId || '',
    })
    setManageOpen(true)
  }

  const onSaveChannelManage = async () => {
    if (!channel || !canManageChannel) return
    const nextName = manageForm.name.trim()
    const nextDesc = manageForm.description.trim()
    const nextId = manageForm.lastivkaId.trim()
    if (!nextName) {
      setManageError('Вкажіть назву каналу.')
      return
    }
    if (channel.visibility !== 'private' && !nextId) {
      setManageError('Для публічного каналу потрібен Lastivka-id.')
      return
    }
    if (channel.visibility !== 'private' && nextId && !ID_RE.test(nextId)) {
      setManageError('Lastivka-id: тільки англ. літери, - та _.')
      return
    }
    try {
      setManageSaving(true)
      await updateChannel(channel.id, {
        name: nextName.trim(),
        description: nextDesc,
        ...(channel.visibility !== 'private' ? { lastivkaId: nextId } : {}),
      })
      refreshDialogs?.()
      refreshChannels?.()
      setManageOpen(false)
    } catch (e) {
      const msg = e.message || 'Помилка оновлення'
      if (msg.toLowerCase().includes('not found')) {
        setManageError('Сервер не знайшов маршрут керування. Перезапустіть Ластівку.')
      } else {
        setManageError(msg)
      }
    } finally {
      setManageSaving(false)
    }
  }

  const onInviteUser = () => {
    const candidates = allUsers.filter((u) => !(members || []).some((m) => m.id === u.id))
    if (!candidates.length) return showAlert('Немає доступних користувачів для додавання')
    setInviteModal(true)
    setInviteUserId(candidates[0]?.id || '')
  }

  const onInviteSubmit = async () => {
    if (!inviteUserId.trim()) return
    try {
      setManageError('')
      await addChannelMember(channelId, inviteUserId.trim())
      const next = await getChannelMembers(channelId)
      setMembers(next)
      refreshChannels?.()
      setInviteModal(false)
    } catch (e) {
      setManageError(e.message || 'Не вдалося додати учасника')
    }
  }

  const onRemoveMember = async (uid) => {
    try {
      setManageError('')
      await removeChannelMember(channelId, uid)
      const next = await getChannelMembers(channelId)
      setMembers(next)
      refreshChannels?.()
    } catch (e) {
      setManageError(e.message || 'Не вдалося видалити учасника')
    }
  }

  const onToggleChannelOption = async (key, value) => {
    try {
      setManageError('')
      if (key === 'visibility' && value === 'public') {
        setVisibilityModal(true)
        setVisibilityLastivkaId(channel?.lastivkaId || '')
        return
      }
      await updateChannel(channelId, { [key]: value })
      refreshChannels?.()
    } catch (e) {
      setManageError(e.message || 'Не вдалося змінити параметр')
    }
  }

  const onVisibilitySubmit = async () => {
    const lid = visibilityLastivkaId.trim()
    if (!lid) return
    if (!ID_RE.test(lid)) {
      setManageError('Lastivka-id: тільки англ. літери, - та _.')
      return
    }
    try {
      setManageError('')
      await updateChannel(channelId, { visibility: 'public', lastivkaId: lid })
      refreshChannels?.()
      setVisibilityModal(false)
    } catch (e) {
      setManageError(e.message || 'Не вдалося змінити параметр')
    }
  }

  if ((isChannel || isDiscussion) && !channel) {
    return (
      <div className={styles.notFound}>
        <p>Канал не знайдено.</p>
        <Link to="/channels">До каналів</Link>
      </div>
    )
  }

  if (mode === 'dm' && !otherUserId) {
    return (
      <div className={styles.notFound}>
        <p>Діалог не обрано.</p>
        <Link to="/channels">До діалогів</Link>
      </div>
    )
  }

  const title = activeDialog?.title || (isChannel ? channel?.name : isDiscussion ? (postId ? `Коментарі · ${channel?.name}` : `Обговорення · ${channel?.name}`) : 'Діалог')
  const subtitle = activeDialog?.subtitle || (channel?.lastivkaId ? `@${channel.lastivkaId}` : '')
  const isOfficial = !!(isChannel || isDiscussion) && channel?.official

  return (
    <div className={styles.page}>
      {showLoadingOverlay && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner}>Завантаження...</div>
        </div>
      )}
      <section className={styles.dialogPane}>
        <header className={styles.header}>
          <div>
            <h1>
              {title}
              {isOfficial && <span className={styles.officialBadge} title="Офіційне ластівка-джерело"> ✓</span>}
            </h1>
            {subtitle && <p className={styles.desc}>{subtitle}{isOfficial && ' · Офіційне ластівка-джерело'}</p>}
          </div>
          <div className={styles.headerRight}>
            {(isChannel || isDiscussion) && (
              <div className={styles.headerTabs}>
                <Link to={`/channels/${channelId}`} className={`${styles.tab} ${isChannel ? styles.tabActive : ''}`}>Канал</Link>
                <Link to={`/channels/${channelId}/discussion`} className={`${styles.tab} ${isDiscussion && !postId ? styles.tabActive : ''}`}>Обговорення</Link>
                {postId && (
                  <span className={`${styles.tab} ${styles.tabActive}`}>Коментарі</span>
                )}
              </div>
            )}
            {(isChannel || isDiscussion) && channel?.ownerId && (
              <Link
                to={channel.ownerId === user?.id ? `/channels/${channelId}/inbox` : `/dm/${channel.ownerId}`}
                className={styles.headerManageBtn}
                title={channel.ownerId === user?.id ? 'Вхідні повідомлення' : 'Написати власнику'}
              >
                ✉
              </Link>
            )}
            {(isChannel || isDiscussion) && canManageChannel && (
              <button type="button" className={styles.headerManageBtn} onClick={onManageChannel} title="Керування каналом">
                ⚙
              </button>
            )}
          </div>
        </header>

        <div className={`${styles.messages} ${loading ? styles.messagesLoading : ''}`} ref={listRef}>
          {loading && <div className={styles.empty}>Завантаження...</div>}
          {!loading && messages.length === 0 && <div className={styles.empty}>Поки порожньо. Напишіть перше повідомлення.</div>}
          {!loading && messages.map((msg, idx) => {
            const own = msg.authorId === user?.id || msg.postedByUserId === user?.id
            const canDeleteAll = own || canManageChannel
            const canUseTrash = isChannel ? canDeleteAll : true
            const msgClassName = own ? styles.msgOwn : (isChannel ? styles.msgChannel : styles.msg)
            const isDeleting = msg._deleting
            const animClass = animatingMessages ? (own ? styles.msgEnterRight : styles.msgEnterLeft) : ''
            return (
              <div key={msg.id} className={`${styles.msgWrapper} ${animClass} ${isDeleting ? styles.msgDeleting : ''}`} style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}>
                <div className={msgClassName}>
                  {msg.forwardedFrom && (
                    <div className={styles.forwarded}>Переслано від{' '}
                      {msg.forwardedFrom.sourceType === 'channel' && msg.forwardedFrom.channelId ? (
                        <Link to={`/channels/${msg.forwardedFrom.channelId}`}>{msg.forwardedFrom.authorName}</Link>
                      ) : msg.forwardedFrom.sourceType === 'discussion' && msg.forwardedFrom.channelId ? (
                        <Link to={`/channels/${msg.forwardedFrom.channelId}/discussion`}>{msg.forwardedFrom.authorName}</Link>
                      ) : (
                        <span>{msg.forwardedFrom.authorName}</span>
                      )}
                    </div>
                  )}
                  <div className={styles.msgAuthorRow}>
                    <span className={styles.msgAuthor}>
                      {isChannel
                        ? `Канал · ${channel?.name || msg.authorName}`
                        : isDiscussion
                          ? msg.authorName || msg.postedByUserName || 'Користувач'
                          : msg.authorName}
                    </span>
                    <button
                      type="button"
                      className={styles.reactionAdd}
                      title="Додати реакцію"
                      onClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                    >
                      😀
                    </button>
                  </div>
                  {reactionPicker === msg.id && (
                    <div className={styles.reactionPicker}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => onReaction(msg.id, emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.attachment?.type === 'image' && msg.attachment?.data && (
                    <img src={msg.attachment.data} alt="" className={styles.msgAttachment} />
                  )}
                  {msg.attachment?.type === 'audio' && msg.attachment?.data && (
                    <audio src={msg.attachment.data} controls className={styles.msgAudio} />
                  )}
                  {msg.attachment?.type === 'file' && (
                    <a href={msg.attachment.data} download={msg.attachment.name} className={styles.msgFile}>📎 {msg.attachment.name || 'Файл'}</a>
                  )}
                  {msg.text && <span className={styles.msgText}>{msg.text}</span>}
                  <div className={styles.msgFooter}>
                    <span className={styles.msgTime}>{new Date(msg.time).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}{msg.editedAt ? ' · змінено' : ''}</span>
                    <div className={styles.msgActions}>
                      {own && <button type="button" onClick={() => onEdit(msg)}>Редаг.</button>}
                      {(isChannel || isDiscussion) && canManageChannel && <button type="button" onClick={() => onPin(msg)}>Закріпити</button>}
                      <button type="button" onClick={() => onForward(msg)}>Переслати</button>
                      {canUseTrash && (
                        <button
                          type="button"
                          className={styles.deleteTrash}
                          title="Видалити"
                          onClick={() => setDeleteTarget({ msg, canDeleteAll, isChannelMessage: msg.type === 'channel' })}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                  {isChannel && channel?.discussionEnabled !== false && (
                    <Link to={`/channels/${channelId}/discussion/${msg.id}`} className={styles.commentsBtn}>
                      💬 Коментарі
                    </Link>
                  )}
                  <div className={styles.msgReactions}>
                    {Object.entries(msg.reactions || {}).map(([emoji, userIds]) => (
                      <button
                        key={emoji}
                        type="button"
                        className={`${styles.reactionBtn} ${(userIds || []).includes(user?.id) ? styles.reactionBtnActive : ''}`}
                        onClick={() => onReaction(msg.id, emoji)}
                        title={`${emoji} ${(userIds || []).length}`}
                      >
                        {emoji} {(userIds || []).length}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <form onSubmit={handleSend} className={styles.form}>
          <button type="button" className={styles.attachBtn} title="Прикріпити файл, зображення або аудіо" onClick={() => fileInputRef.current?.click()}>
            📎
          </button>
          <input type="file" ref={fileInputRef} className={styles.fileInput} accept="image/*,audio/*,.pdf,.doc,.docx,.txt" onChange={onAttachmentPick} />
          {pendingAttachment && (
            <span className={styles.pendingAtt}>
              {pendingAttachment.type === 'image' && <img src={pendingAttachment.data} alt="" />}
              {pendingAttachment.type !== 'image' && pendingAttachment.name}
              <button type="button" onClick={() => setPendingAttachment(null)}>×</button>
            </span>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isChannel ? 'Опублікувати допис у каналі...' : isDiscussion ? 'Написати коментар...' : 'Напишіть повідомлення...'}
            maxLength={2000}
            disabled={sending}
          />
          <button type="submit" disabled={(!input.trim() && !pendingAttachment) || sending}>{sending ? '...' : 'Надіслати'}</button>
        </form>
      </section>

      {deleteTarget && (
        <div className={styles.modalBackdrop} onClick={() => { setDeleteTarget(null); setDeleteError('') }}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h4>Видалити повідомлення?</h4>
            {deleteError && <p className={styles.modalErr}>{deleteError}</p>}
            {deleteTarget.isChannelMessage ? (
              <div className={styles.modalActions}>
                <button type="button" className={styles.dangerBtn} onClick={() => onDelete(deleteTarget.msg, 'all')}>Видалити</button>
                <button type="button" onClick={() => setDeleteTarget(null)}>Скасувати</button>
              </div>
            ) : (
              <div className={styles.modalActions}>
                <button type="button" onClick={() => onDelete(deleteTarget.msg, 'self')}>Для себе</button>
                {deleteTarget.canDeleteAll && <button type="button" className={styles.dangerBtn} onClick={() => onDelete(deleteTarget.msg, 'all')}>Для всіх</button>}
                <button type="button" onClick={() => setDeleteTarget(null)}>Скасувати</button>
              </div>
            )}
          </div>
        </div>
      )}

      {manageOpen && (
        <div className={styles.modalBackdrop} onClick={() => setManageOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h4>Керування каналом</h4>
            {manageError && <div className={styles.manageError}>{manageError}</div>}
            <div className={styles.manageForm}>
              <label>
                Назва
                <input
                  type="text"
                  value={manageForm.name}
                  onChange={(e) => setManageForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label>
                Опис
                <textarea
                  rows={3}
                  value={manageForm.description}
                  onChange={(e) => setManageForm((p) => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'none' }}
                />
              </label>
              {channel?.visibility !== 'private' && (
                <label>
                  Lastivka-id
                  <input
                    type="text"
                    autoComplete="off"
                    value={manageForm.lastivkaId}
                    onChange={(e) => setManageForm((p) => ({ ...p, lastivkaId: e.target.value }))}
                    placeholder="example_id"
                  />
                </label>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.dangerBtn} onClick={onSaveChannelManage} disabled={manageSaving}>
                {manageSaving ? 'Збереження...' : 'Зберегти'}
              </button>
              <button type="button" onClick={() => setManageOpen(false)} disabled={manageSaving}>Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {visibilityModal && (
        <div className={styles.modalBackdrop} onClick={() => { setVisibilityModal(false); setManageError('') }}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h4>Зробити канал публічним</h4>
            <p>Вкажіть Lastivka-id для публічного каналу (щоб вас могли знайти у пошуку):</p>
            {manageError && <div className={styles.manageError}>{manageError}</div>}
            <div className={styles.manageForm}>
              <label>
                Lastivka-id
                <input
                  type="text"
                  autoComplete="off"
                  value={visibilityLastivkaId}
                  onChange={(e) => setVisibilityLastivkaId(e.target.value)}
                  placeholder="example_id"
                />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.dangerBtn} onClick={onVisibilitySubmit}>Зберегти</button>
              <button type="button" onClick={() => { setVisibilityModal(false); setManageError('') }}>Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {inviteModal && (
        <div className={styles.modalBackdrop} onClick={() => { setInviteModal(false); setManageError('') }}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h4>Запросити користувача</h4>
            {manageError && <div className={styles.manageError}>{manageError}</div>}
            <div className={styles.manageForm}>
              <label>
                Оберіть користувача
                <select
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                >
                  {allUsers.filter((u) => !(members || []).some((m) => m.id === u.id)).map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.dangerBtn} onClick={onInviteSubmit}>Запросити</button>
              <button type="button" onClick={() => { setInviteModal(false); setManageError('') }}>Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className={styles.modalBackdrop} onClick={() => setEditModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h4>Редагувати повідомлення</h4>
            <div className={styles.manageForm}>
              <label>
                Текст
                <textarea
                  rows={4}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.dangerBtn} onClick={onEditSubmit}>Зберегти</button>
              <button type="button" onClick={() => setEditModal(null)}>Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {forwardModal && (
        <div className={styles.modalBackdrop} onClick={() => setForwardModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h4>Переслати повідомлення</h4>
            <p>Формат: dm:&lt;userId&gt; або channel:&lt;channelId&gt; або discussion:&lt;channelId&gt;</p>
            <div className={styles.manageForm}>
              <label>
                Куди
                <input
                  type="text"
                  value={forwardTarget}
                  onChange={(e) => setForwardTarget(e.target.value)}
                  placeholder="dm:user-123"
                />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.dangerBtn} onClick={onForwardSubmit}>Переслати</button>
              <button type="button" onClick={() => setForwardModal(null)}>Скасувати</button>
            </div>
          </div>
        </div>
      )}

      <aside className={styles.detailsPane}>
        {(isChannel || isDiscussion) ? (
          <>
            <div className={styles.profileTop}>
              <div className={styles.bigAvatar}>
                {channel?.avatar ? <img src={channel.avatar} alt={channel?.name || 'channel'} className={styles.bigAvatarImg} /> : '#'}
              </div>
              <h4>{channel?.name}{channel?.official && <span className={styles.officialBadge} title="Офіційне ластівка-джерело"> ✓</span>}</h4>
              <p>
                {channel?.visibility === 'private' ? 'Приватний канал' : (channel?.lastivkaId ? `@${channel.lastivkaId}` : 'без-id')}
                {` · ${members.length} учасн.`}
                {channel?.description ? ` · ${channel.description}` : ''}
              </p>
            </div>
            <div className={styles.infoList}>
              {manageError && <div className={styles.manageError}>{manageError}</div>}
              <div className={styles.infoRow}><span>Тип</span><span>{channel?.kind === 'group' ? 'Група' : 'Канал'}</span></div>
              <div className={styles.infoRow}><span>Видимість</span><span>{channel?.visibility === 'private' ? 'Приватний' : 'Публічний'}</span></div>
              <div className={styles.infoRow}><span>Власник</span><span>{canManageChannel ? 'Ви' : 'Інший'}</span></div>
              <div className={styles.infoRow}><span>Учасники</span><span>{members.length}</span></div>
              <div className={styles.infoRow}><span>Повідомлень</span><span>{messages.length}</span></div>
              {canManageChannel && <button className={styles.manageBtn} type="button" onClick={onManageChannel}>Керування каналом</button>}
              {canManageChannel && (
                <>
                  {channel?.visibility === 'private' && channel?.inviteCode && (
                    <div className={styles.infoRow}><span>Приватне посилання</span><span>invite://{channel.inviteCode}</span></div>
                  )}
                  <button className={styles.manageBtn} type="button" onClick={() => onToggleChannelOption('visibility', channel?.visibility === 'private' ? 'public' : 'private')}>
                    {channel?.visibility === 'private' ? 'Зробити публічним' : 'Зробити приватним'}
                  </button>
                  <button className={styles.manageBtn} type="button" onClick={() => onToggleChannelOption('commentsEnabled', !channel?.commentsEnabled)}>
                    {channel?.commentsEnabled === false ? 'Відкрити дописи' : 'Закрити дописи'}
                  </button>
                  <button className={styles.manageBtn} type="button" onClick={() => onToggleChannelOption('discussionEnabled', !channel?.discussionEnabled)}>
                    {channel?.discussionEnabled === false ? 'Увімкнути обговорення' : 'Вимкнути обговорення'}
                  </button>
                  <button className={styles.manageBtn} type="button" onClick={onInviteUser}>Запросити користувача</button>
                </>
              )}
              <div className={styles.memberList}>
                {(members || []).map((m) => (
                  <div key={m.id} className={styles.memberRow}>
                    <span>{m.name}{m.lastivkaId ? ` · @${m.lastivkaId}` : ''}</span>
                    <span>
                      <Link to={`/dm/${m.id}`}>Написати</Link>
                      {canManageChannel && m.id !== channel?.ownerId && (
                        <button type="button" onClick={() => onRemoveMember(m.id)}>Видалити</button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.profileTop}>
              <div className={styles.bigAvatar}>{(title || '?').charAt(0).toUpperCase()}</div>
              <h4>{title}</h4>
              <p>{subtitle || 'Приватний діалог'}</p>
            </div>
            <div className={styles.infoList}>
              <div className={styles.infoRow}><span>Повідомлення</span><span>{messages.length}</span></div>
              <div className={styles.infoRow}><span>Безпека</span><span>Локально</span></div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
