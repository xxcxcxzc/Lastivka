import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Channels from './pages/Channels'
import CreateChannel from './pages/CreateChannel'
import Search from './pages/Search'
import Chat from './pages/Chat'
import ChannelInbox from './pages/ChannelInbox'
import DirectMessages from './pages/DirectMessages'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

function ProtectedRoute({ children }) {
  const { user, loading } = useApp()
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Завантаження Ластівки...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }) {
  const { user, loading } = useApp()
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Завантаження...</div>
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/channels" replace />} />
        <Route path="channels" element={<Channels />} />
        <Route path="channels/new" element={<CreateChannel />} />
        <Route path="channels/:id" element={<Chat mode="channel" />} />
        <Route path="channels/:id/inbox" element={<ChannelInbox />} />
        <Route path="channels/:id/discussion/:postId" element={<Chat mode="discussion" />} />
        <Route path="channels/:id/discussion" element={<Chat mode="discussion" />} />
        <Route path="dm" element={<DirectMessages />} />
        <Route path="dm/:userId" element={<Chat mode="dm" />} />
        <Route path="search" element={<Search />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
