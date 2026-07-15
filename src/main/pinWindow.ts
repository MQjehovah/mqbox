import { BrowserWindow, screen, clipboard, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { loadView } from './utils'
import { writeFileSync } from 'fs'
import { getPluginEditor } from './plugin/host'

let editorWindow: BrowserWindow | null = null
const pinWindows: Map<string, BrowserWindow> = new Map()

/**
 * ★ 存储每个钉图窗口的原始尺寸（创建时固定），
 *    拖拽过程中永不使用 getSize() 读取，
 *    防止 DWM 合成事件导致 getSize() 返回被篡改的尺寸形成正反馈。
 */
const pinOriginalSizeMap = new WeakMap<BrowserWindow, { width: number; height: number }>()

/** 获取钉图窗口的原始尺寸（创建时固定的值） */
export function getPinOriginalSize(win: BrowserWindow): { width: number; height: number } | undefined {
  return pinOriginalSizeMap.get(win)
}

/** 清理钉图窗口的原始尺寸记录 */
function clearPinOriginalSize(win: BrowserWindow): void {
  pinOriginalSizeMap.delete(win)
}

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
 * 生成钉图窗口的最小化 HTML 骨架（不含图片数据，避免大图 data:URL 触发布局正反馈）
 * 搭配 buildPinInjectScript() 通过 executeJavaScript 注入图片 src 和拖拽逻辑。
 *
 * 不再使用 -webkit-app-region:drag 原生 OS 拖拽（Windows DWM 会篡改无框透明窗口尺寸），
 * 改为 JS 版拖拽（mousedown/mousemove/mouseup + IPC pin-move-delta → setBounds 锁定尺寸）。
 */
function buildPinSkeletonHtml(): string {
  return '<!DOCTYPE html><html><head><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'html,body{width:100%;height:100%;overflow:hidden;background:#fff}' +
    '#pin{position:relative;width:100%;height:100%;overflow:hidden;-webkit-app-region:drag}' +
    '#pin-img{width:100%;height:100%;display:block;pointer-events:none;user-select:none;-webkit-user-select:none;image-rendering:-webkit-optimize-contrast}' +
    '#close-btn{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:none;' +
    'background:rgba(0,0,0,.5);cursor:pointer;z-index:1000;padding:0;display:flex;align-items:center;justify-content:center;' +
    '-webkit-app-region:no-drag;transition:background .15s,opacity .15s;opacity:.5}' +
    '#close-btn:hover{background:rgba(255,0,0,.8);opacity:1}' +
    '#pin:hover #close-btn{opacity:.8}' +
    '</style></head><body>' +
    '<div id="pin"><img id="pin-img">' +
    '<button id="close-btn"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg></button>' +
    '</div></body></html>'
}

function buildPinInjectScript(safeUrl: string): string {
  return '(function(){' +
    'var i=document.getElementById("pin-img"),c=document.getElementById("close-btn");' +
    'i.src=' + safeUrl + ';' +
    'c.addEventListener("click",function(e){e.stopPropagation();window.mqbox.screenshot.pinClose()})' +
    // 拖拽由 -webkit-app-region:drag 原生处理，缩放由主进程 input-event 处理
    '})()'
}

export async function pinImage(dataUrl: string): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const image = nativeImage.createFromDataURL(dataUrl)
  const size = image.getSize()

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  let width = size.width
  let height = size.height

  if (width > screenWidth * 0.9) {
    const ratio = screenWidth * 0.9 / width
    width = Math.floor(width * ratio)
    height = Math.floor(height * ratio)
  }
  if (height > screenHeight * 0.9) {
    const ratio = screenHeight * 0.9 / height
    height = Math.floor(height * ratio)
    width = Math.floor(width * ratio)
  }

  const initialX = Math.floor((screenWidth - width) / 2) + primaryDisplay.bounds.x
  const initialY = Math.floor((screenHeight - height) / 2) + primaryDisplay.bounds.y

  const win = new BrowserWindow({
    width,
    height,
    x: initialX,
    y: initialY,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
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

  console.log(`pinImage: image=${size.width}x${size.height}, window=${width}x${height} DIP, sf=${primaryDisplay.scaleFactor}`)

  // ★ 缩放期望尺寸
  ;(win as any)._expectedW = width
  ;(win as any)._expectedH = height

  // ★ Windows 原生消息钩子拦截滚轮（绕过 -webkit-app-region:drag 对 wheel 的拦截）
  if (process.platform === 'win32') {
    const WM_MOUSEWHEEL = 0x020A
    win.hookWindowMessage(WM_MOUSEWHEEL, (wParam: Buffer, lParam: Buffer) => {
      if (win.isDestroyed()) return
      const zDelta = wParam.readInt16LE(2)
      const screenX = lParam.readInt16LE(0)
      const screenY = lParam.readInt16LE(2)

      const factor = zDelta > 0 ? 1.15 : 1 / 1.15
      const [curW, curH] = win.getSize()
      const nw = Math.max(50, Math.round(curW * factor))
      const nh = Math.max(50, Math.round(curH * factor))

      const [winX, winY] = win.getPosition()
      const mx = screenX - winX
      const my = screenY - winY
      const ratioX = mx / curW
      const ratioY = my / curH
      const newX = Math.round(winX + mx - ratioX * nw)
      const newY = Math.round(winY + my - ratioY * nh)

      ;(win as any)._expectedW = nw
      ;(win as any)._expectedH = nh
      win.setBounds({ x: newX, y: newY, width: nw, height: nh })
    })
  }

  const skeletonHtml = buildPinSkeletonHtml()
  win.loadURL('data:text/html,' + encodeURIComponent(skeletonHtml))

  // 转发 pin 窗口的 console 日志
  win.webContents.on('console-message', (_, __, message) => {
    console.log(`[Pin ${id}] ${message}`)
  })

  win.webContents.once('did-finish-load', async () => {
    try {
      const safeUrl = JSON.stringify(dataUrl)
      const injectScript = buildPinInjectScript(safeUrl)
      await win.webContents.executeJavaScript(injectScript)
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
      }
    } catch (e) {
      console.error('pinImage: executeJavaScript error:', e)
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
      }
    }
  })

  win.on('closed', () => {
    pinWindows.delete(id)
    clearPinOriginalSize(win)
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
