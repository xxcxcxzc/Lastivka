import { createContext, useContext, useState, useCallback } from 'react'
import styles from '../components/AlertModal.module.css'

const AlertContext = createContext(null)

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null)

  const showAlert = useCallback((message, type = 'info') => {
    setAlert({ message: String(message), type })
  }, [])

  const hideAlert = useCallback(() => setAlert(null), [])

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {alert && (
        <div className={styles.backdrop} onClick={hideAlert}>
          <div className={styles.card} onClick={(e) => e.stopPropagation()}>
            <p className={styles.message}>{alert.message}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.okBtn} onClick={hideAlert}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlert must be used within AlertProvider')
  return ctx
}
