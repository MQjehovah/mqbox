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
    'html,body{width:100%;height:100%;overflow:hidden;cursor:default}' +
    'body{background:transparent}' +
    '#pin{position:relative;width:100%;height:100%;overflow:hidden}' +
    '#pin-img{width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;user-select:none;-webkit-user-select:none}' +
    '#close-btn{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,.45);color:#fff;font-size:14px;line-height:24px;text-align:center;cursor:pointer;z-index:1000;padding:0;display:flex;align-items:center;justify-content:center;transition:background .15s}' +
    '#close-btn:hover{background:rgba(255,0,0,.7)}' +
    '</style></head><body>' +
    '<div id="pin"><img id="pin-img"><button id="close-btn">\u2715</button></div>' +
    '</body></html>'
}

/**
 * 生成钉图窗口的注入脚本（通过 executeJavaScript 注入）
 * 设置 img.src、关闭按钮事件，以及 JS 版拖拽逻辑。
 *
 * 拖拽逻辑：mousedown→mousemove→mouseup，通过 IPC pin-move-delta 将位移发到主进程，
 * 主进程用 setBounds({x,y,width,height}) 锁定原始尺寸移动窗口，避免 DWM 篡改。
 */
function buildPinInjectScript(safeUrl: string): string {
  return '(function(){' +
    'var p=document.getElementById("pin"),c=document.getElementById("close-btn"),i=document.getElementById("pin-img");' +
    'i.src=' + safeUrl + ';' +
    'c.addEventListener("click",function(e){e.stopPropagation();var a=window.mqbox;if(a&&a.screenshot&&a.screenshot.pinClose)a.screenshot.pinClose()});' +
    'var dx=0,dy=0,ok=0,px=0,py=0;' +
    'p.addEventListener("mousedown",function(e){ok=1;px=e.clientX;py=e.clientY});' +
    'document.addEventListener("mousemove",function(e){if(!ok)return;dx=e.clientX-px;dy=e.clientY-py;px=e.clientX;py=e.clientY;var a=window.mqbox;if(a&&a.screenshot&&a.screenshot.send)a.screenshot.send("pin-move-delta",{dx:dx,dy:dy})});' +
    'document.addEventListener("mouseup",function(){ok=0})' +
    '})()'
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

  // ★ 存储原始尺寸，以备二次校验使用
  pinOriginalSizeMap.set(win, { width, height })

  // 强制锁定窗口尺寸（Windows 透明窗口上 resizable:false 可能被忽略）
  win.setMinimumSize(width, height)
  win.setMaximumSize(width, height)

  // ===== ★ 防 DWM 拖拽尺寸篡改 =====
  // 问题: Windows DWM 在拖拽透明无框窗口时会在 OS 层面修改窗口尺寸
  // （横移变宽、纵移变高），setMinimumSize/setMaximumSize/resizable:false 均无法阻止。
  //
  // 修复:
  // 1. resize 事件监听 — DWM 改尺寸会触发 resize 事件，立即纠正
  // 2. 定时轮询 — 作为安全兜底（DWM 可能不触发 resize 事件）

  // ★ 监听 resize 事件，DWM 篡改后立即纠正回原始尺寸
  win.on('resize', function onPinResize() {
    if (win.isDestroyed()) return
    const [curW, curH] = win.getSize()
    if (curW !== width || curH !== height) {
      win.setBounds({ x: win.x, y: win.y, width, height })
    }
  })

  // ★ 定时轮询作为安全兜底（DWM 可能在 resize 事件后再次篡改）
  const correctionTimer = setInterval(() => {
    if (win.isDestroyed()) { clearInterval(correctionTimer); return }
    const [curW, curH] = win.getSize()
    if (curW !== width || curH !== height) {
      win.setBounds({ width, height })
    }
  }, 100)

  // 步骤 1: 加载最小化 HTML 骨架（不含图片数据，只有 DOM 结构 + CSS）
  // 使用 tiny data:text/html 而非 about:blank，避免 about:blank 下 did-finish-load 可靠性问题
  const skeletonHtml = buildPinSkeletonHtml()
  win.loadURL('data:text/html,' + encodeURIComponent(skeletonHtml))

  // 步骤 2: did-finish-load 后注入图片 src、关闭按钮事件和 JS 拖拽逻辑
  win.webContents.once('did-finish-load', async () => {
    try {
      const safeUrl = JSON.stringify(dataUrl)
      const injectScript = buildPinInjectScript(safeUrl)
      await win.webContents.executeJavaScript(injectScript)
      if (!win.isDestroyed()) {
        win.setSize(width, height)
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
    clearInterval(correctionTimer)
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
