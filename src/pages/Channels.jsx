import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import * as api from '../api'
import styles from './Channels.module.css'

export default function Channels() {
  const { user, dialogs, channels } = useApp()
  const [feedMode, setFeedMode] = useState('dialogs') // 'dialogs' | 'popular'
  const [popularPosts, setPopularPosts] = useState([])
  const [popularLoading, setPopularLoading] = useState(false)
  const [keywordMessages, setKeywordMessages] = useState([])
  const [keywordsInput, setKeywordsInput] = useState('')
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const [keywordsApplied, setKeywordsApplied] = useState('')

  const pinnedItems = dialogs.filter((d) => d.pinned).slice(0, 13)

  const loadPopular = useCallback(async () => {
    setPopularLoading(true)
    try {
      const posts = await api.feed.popular()
      setPopularPosts(posts)
    } catch (_) {
      setPopularPosts([])
    } finally {
      setPopularLoading(false)
    }
  }, [])

  useEffect(() => {
    if (feedMode === 'popular') loadPopular()
  }, [feedMode, loadPopular])

  const loadKeywordFeed = useCallback(async () => {
    const q = keywordsInput.trim()
    setKeywordsApplied(q)
    if (!q) {
      setKeywordMessages([])
      return
    }
    setKeywordsLoading(true)
    try {
      const list = await api.feed.byKeywords(q)
      setKeywordMessages(list)
    } catch (_) {
      setKeywordMessages([])
    } finally {
      setKeywordsLoading(false)
    }
  }, [keywordsInput])

  const channelById = (id) => channels.find((c) => c.id === id) || null

  const toLink = (d) => {
    if (d.type === 'dm') return `/dm/${d.id}`
    if (d.type === 'discussion') return `/channels/${d.id}/discussion`
    return `/channels/${d.id}`
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{feedMode === 'popular' ? 'Популярне' : 'Діалоги'}</h1>
        <button
          type="button"
          className={styles.feedToggleBtn}
          onClick={() => setFeedMode(feedMode === 'popular' ? 'dialogs' : 'popular')}
          title={feedMode === 'popular' ? 'Показати діалоги' : 'Стрічка популярних постів з моїх каналів'}
        >
          {feedMode === 'popular' ? '📋 Діалоги' : '🔥 Популярне'}
        </button>
      </div>

      <section className={styles.mainFeed}>
        {feedMode === 'dialogs' && (
          <>
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
                      <Link to={toLink(d)} className={styles.channelMain}>
                        {d.avatar ? (
                          <img src={d.avatar} alt="" className={styles.channelIconImg} />
                        ) : (
                          <span className={styles.channelIcon}>#</span>
                        )}
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
          </>
        )}
        {feedMode === 'popular' && (
          <>
            {popularLoading ? (
              <div className={styles.empty}>Завантаження...</div>
            ) : popularPosts.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🔥</span>
                <p>Поки немає постів з переглядами або ви не в жодному каналі</p>
              </div>
            ) : (
              <ul className={styles.popularList}>
                {popularPosts.map((post) => {
                  const ch = post.channel || channelById(post.channelId)
                  const link = `/channels/${post.channelId}`
                  return (
                    <li key={post.id}>
                      <Link to={link} className={styles.popularCard}>
                        <div className={styles.popularMeta}>
                          <span className={styles.popularChannel}>{ch?.name || 'Канал'}</span>
                          <span className={styles.popularViews}>👁 {post.viewCount || 0}</span>
                        </div>
                        {post.text && <p className={styles.popularText}>{post.text.slice(0, 200)}{post.text.length > 200 ? '…' : ''}</p>}
                        {post.attachment?.type === 'image' && post.attachment?.data && (
                          <img src={post.attachment.data} alt="" className={styles.popularThumb} />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {pinnedItems.length > 0 && (
        <section className={styles.pinnedBar} aria-label="Закріплені">
          <div className={styles.pinnedRow}>
            {pinnedItems.map((d) => (
              <Link
                key={d.key}
                to={toLink(d)}
                className={styles.pinnedAvatar}
                title={d.title}
              >
                {d.avatar ? (
                  <img src={d.avatar} alt="" />
                ) : (
                  <span>{(d.title || '?').charAt(0).toUpperCase()}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={styles.keywordFeed}>
        <h2 className={styles.keywordTitle}>Стрічка за ключовими словами</h2>
        <p className={styles.keywordDesc}>Повідомлення з усіх каналів і чатів, де є вказані слова</p>
        <div className={styles.keywordInputRow}>
          <input
            type="text"
            className={styles.keywordInput}
            placeholder="Слова через кому або пробіл"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadKeywordFeed()}
          />
          <button type="button" className={styles.keywordBtn} onClick={loadKeywordFeed}>
            Застосувати
          </button>
        </div>
        <div className={styles.keywordResults}>
          {keywordsLoading && <div className={styles.keywordLoading}>Завантаження...</div>}
          {!keywordsLoading && keywordsApplied && keywordMessages.length === 0 && (
            <div className={styles.keywordEmpty}>Нічого не знайдено</div>
          )}
          {!keywordsLoading && keywordMessages.length > 0 && (
            <ul className={styles.keywordList}>
              {keywordMessages.map((m) => {
                const isChannel = m.type === 'channel' || m.type === 'discussion'
                const otherId = m.dmKey ? m.dmKey.split('::').find((id) => id !== user?.id) : null
                const href = isChannel ? `/channels/${m.channelId}${m.type === 'discussion' ? '/discussion' : ''}` : (otherId ? `/dm/${otherId}` : '#')
                return (
                  <li key={m.id}>
                    <Link to={href} className={styles.keywordMsg}>
                      <span className={styles.keywordMsgMeta}>
                        {m.authorName || 'Користувач'} · {m.channelId ? (channelById(m.channelId)?.name || 'Канал') : 'ДМ'}
                      </span>
                      <span className={styles.keywordMsgText}>{m.text?.slice(0, 150)}{(m.text?.length || 0) > 150 ? '…' : ''}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
