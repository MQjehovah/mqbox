import { BrowserWindow, screen, clipboard, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { loadView } from './utils'
import { writeFileSync } from 'fs'
import { getPluginEditor } from './plugin/host'

let editorWindow: BrowserWindow | null = null
const pinWindows: Map<string, BrowserWindow> = new Map()

export async function showEditor(dataUrl: string): Promise<void> {
  if (editorWindow) {
    editorWindow.show()
    editorWindow.focus()
    editorWindow.webContents.send('screenshot-editor:set-image', dataUrl)
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const windowWidth = Math.min(800, width - 100)
  const windowHeight = Math.min(600, height - 100)

  editorWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((width - windowWidth) / 2),
    y: Math.floor((height - windowHeight) / 2),
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  loadView(editorWindow, 'plugin-editor:screenshot')

  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow?.show()
    editorWindow?.focus()
    setTimeout(() => {
      editorWindow?.webContents.send('screenshot-editor:set-image', dataUrl)
    }, 100)
  })

  editorWindow.on('closed', () => {
    editorWindow = null
  })
}

/**
 * 生成钉图窗口的完整 HTML 页面（含拖拽 + 关闭按钮）
 * 通过 data:text/html 直接加载，无需 did-finish-load + executeJavaScript
 */
function generatePinHtml(dataUrl: string): string {
  const safeUrl = JSON.stringify(dataUrl)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:100%; height:100%; overflow:hidden; cursor:default; }
body { display:flex; align-items:center; justify-content:center; background:transparent; }
#pin { position:relative; width:100%; height:100%; }
#pin-img { width:100%; height:100%; object-fit:contain; display:block; pointer-events:none; user-select:none; -webkit-user-select:none; }
#close-btn {
  position:absolute; top:6px; right:6px;
  width:24px; height:24px; border-radius:50%;
  border:none; background:rgba(0,0,0,0.45);
  color:#fff; font-size:14px; line-height:24px; text-align:center;
  cursor:pointer; z-index:1000; padding:0;
  display:flex; align-items:center; justify-content:center;
  transition:background 0.15s;
}
#close-btn:hover { background:rgba(255,0,0,0.7); }
</style>
</head>
<body>
<div id="pin">
  <img id="pin-img" src=${safeUrl}>
  <button id="close-btn">✕</button>
</div>
<script>
(function() {
  var closeBtn = document.getElementById('close-btn');

  // 拖拽逻辑 - 用 window.screenX/Y 跟踪窗口绝对位置（标准 DOM 属性，contextIsolation 下可用）
  var isDragging = false;
  var startX = 0, startY = 0;
  var winX = window.screenX || window.screenLeft || 0;
  var winY = window.screenY || window.screenTop || 0;

  document.addEventListener('mousedown', function(e) {
    if (e.target.id === 'close-btn') return;
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var dx = e.screenX - startX;
    var dy = e.screenY - startY;
    winX += dx;
    winY += dy;
    startX = e.screenX;
    startY = e.screenY;
    window.mqbox?.screenshot?.pinMove(winX, winY);
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
  });

  // 关闭按钮
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    window.mqbox?.screenshot?.pinClose();
  });
})();
</script>
</body>
</html>`
}

export async function pinImage(dataUrl: string): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const image = nativeImage.createFromDataURL(dataUrl)
  const size = image.getSize()

  const maxWidth = 400
  const maxHeight = 300
  let width = size.width
  let height = size.height

  if (width > maxWidth) {
    const ratio = maxWidth / width
    width = maxWidth
    height = Math.floor(height * ratio)
  }
  if (height > maxHeight) {
    const ratio = maxHeight / height
    height = maxHeight
    width = Math.floor(width * ratio)
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const initialX = Math.floor((screenWidth - width) / 2)
  const initialY = Math.floor((screenHeight - height) / 2)

  const win = new BrowserWindow({
    width,
    height,
    x: initialX,
    y: initialY,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 方案：直接通过 data:text/html 加载完整 HTML 页面
  // 替代旧的 "创建空窗口 → 等 did-finish-load → executeJavaScript 注入" 的两段式模式
  const htmlContent = generatePinHtml(dataUrl)
  const encoded = Buffer.from(htmlContent, 'utf-8').toString('base64')
  win.loadURL(`data:text/html;base64,${encoded}`)

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.on('closed', () => {
    pinWindows.delete(id)
  })

  pinWindows.set(id, win)
}

export async function saveImage(dataUrl: string): Promise<void> {
  const result = await dialog.showSaveDialog({
    title: '保存截图',
    defaultPath: `screenshot_${Date.now()}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  })

  if (result.filePath) {
    const base64 = dataUrl.split(',')[1]
    writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
  }
}

export async function copyImage(dataUrl: string): Promise<void> {
  const image = nativeImage.createFromDataURL(dataUrl)
  clipboard.writeImage(image)
}

export function closeEditor(): void {
  if (editorWindow) {
    editorWindow.close()
    editorWindow = null
  }
}

export function closeAllPins(): void {
  const windows = Array.from(pinWindows.values())
  for (const win of windows) {
    win.close()
  }
  pinWindows.clear()
}