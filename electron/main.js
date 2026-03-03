const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')

const appPath = process.cwd()
const iconPath = path.join(appPath, 'logo', 'LastiVka.ico')

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      const req = http.get('http://127.0.0.1:3001/api/channels', () => {
        req.destroy()
        resolve()
      })
      req.on('error', () => {
        attempts++
        if (attempts < 60) setTimeout(check, 250)
        else reject(new Error('Сервер не запустився'))
      })
    }
    setTimeout(check, 300)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    title: 'Ластівка',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  win.loadURL('http://127.0.0.1:3001')
}

app.whenReady().then(() => {
  waitForServer()
    .then(createWindow)
    .catch((err) => {
      console.error(err)
      app.quit()
    })
})

app.on('window-all-closed', () => app.quit())
