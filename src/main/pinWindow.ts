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
 * 生成钉图窗口的交互式 HTML/JS 注入代码
 * 包含: 图片显示 + 鼠标拖拽移动 + 关闭按钮
 */
function generatePinHtml(dataUrl: string, initialX: number, initialY: number): string {
  const safeUrl = JSON.stringify(dataUrl)

  // 构建页面 HTML 结构
  const html =
    '<div id="pin" style="width:100%;height:100%;position:relative;overflow:hidden;">' +
    '<img id="pin-img" style="width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;user-select:none;-webkit-user-select:none;">' +
    '<button id="close-btn" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,0.45);color:#fff;font-size:14px;line-height:24px;text-align:center;cursor:pointer;z-index:1000;padding:0;display:flex;align-items:center;justify-content:center;transition:background 0.15s;">✕</button>' +
    '</div>'

  const safeHtml = JSON.stringify(html)

  return `
    (function() {
      document.body.innerHTML = ${safeHtml};
      document.getElementById('pin-img').src = ${safeUrl};
      document.body.style.margin = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.cursor = 'default';

      // 高亮关闭按钮 hover 效果
      var closeBtn = document.getElementById('close-btn');
      closeBtn.addEventListener('mouseenter', function() {
        closeBtn.style.background = 'rgba(255,0,0,0.7)';
      });
      closeBtn.addEventListener('mouseleave', function() {
        closeBtn.style.background = 'rgba(0,0,0,0.45)';
      });

      // === 拖拽逻辑 ===
      var isDragging = false;
      var startX = 0, startY = 0;
      var winX = ${initialX}, winY = ${initialY};

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

      // === 关闭按钮 ===
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        window.mqbox?.screenshot?.pinClose();
      });
    })();
  `
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

  // ★ 注入完整交互式 HTML（含拖拽 + 关闭按钮）
  // ★ 必须等待 did-finish-load，确保 document.body 存在后再注入
  const js = generatePinHtml(dataUrl, initialX, initialY)
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(js)
      win.show()
      win.focus()
    } catch (e) {
      console.error('pinImage: executeJavaScript failed:', e)
      win.close()
    }
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