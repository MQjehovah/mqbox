/**
 * ScreenshotPanel.vue 组件测试
 *
 * ★ 架构变更说明（2024重构）：
 *    旧版：每个显示器独立一个蒙版（.screen-mask），通过 getMaskStyle(display) 计算
 *    新版：单一蒙版层（.mask-layer），通过 maskStyle computed 属性覆盖整个 panel，
 *          clip-path polygon 使用虚拟坐标系（相对于 virtualLeft/virtualTop）
 *
 * ★ setData 限制说明：
 *    Vue 3 <script setup> 的 ref 通过 setData 无法可靠修改。
 *    因此组件状态通过 mock window.mqbox.screenshot.getAllScreens 注入，
 *    onMounted 会自动处理 displays/images 并调用 calcVirtualScreen()。
 *    对于需要显式控制的状态（如 isSelecting、selection），通过直接赋值 wrapper.vm 的 ref 实现。
 *
 * 重点测试：
 * - maskStyle computed：单蒙版覆盖、无选区时无clip-path、选区时polygon抠洞
 * - getDisplayStyle()：各屏图片定位
 * - selectionStyle computed：选区指示器
 * - calcVirtualScreen()：虚拟屏幕范围计算
 * - 初始状态（无蒙版）
 * - 选区中状态（蒙版抠洞）
 * - 双屏场景（左负坐标 + 主屏）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ScreenshotPanel from '@/components/ScreenshotPanel.vue'

// ====== 测试数据 ======
const singleDisplay = [{
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  scaleFactor: 1,
  isPrimary: true,
  label: '主屏幕'
}]

const dualDisplays = [
  {
    id: 1,
    bounds: { x: -2048, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: false,
    label: '左屏幕'
  },
  {
    id: 2,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: true,
    label: '主屏幕'
  }
]

// ====== 模拟 window.mqbox.screenshot API ======
beforeEach(() => {
  ;(window as any).mqbox = {
    screenshot: {
      capture: vi.fn(async () => 'data:image/png;base64,mocked'),
      cancel: vi.fn(),
      getAllScreens: vi.fn()
    }
  }
})

// ====== 辅助：创建组件，通过 mock 注入初始数据 ======
function createWrapper(displays: any[] = [], images: string[] = []) {
  ;(window as any).mqbox.screenshot.getAllScreens = vi.fn(async () => ({
    displays,
    images
  }))
  return mount(ScreenshotPanel, {
    global: {
      stubs: {
        'img': true
      }
    },
    attachTo: document.body
  })
}

/**
 * 等待所有 pending 的 async 操作完成（包括 onMounted 中的 await）
 */
async function flushPromises() {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  await wrapper.vm.$nextTick()
}

/**
 * 等待组件完成初始化（onMounted async 完成 + DOM 更新）
 */
async function waitForInit(wrapper: ReturnType<typeof mount>) {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  await wrapper.vm.$nextTick()
}

// ====== 测试 ======
describe('ScreenshotPanel.vue - 蒙版渲染', () => {

  describe('单屏场景', () => {
    it('初始状态应有 1 个 screen-container 和 1 个 mask-layer', async () => {
      const wrapper = createWrapper(singleDisplay, ['data:image/png;base64,test'])
      await waitForInit(wrapper)

      const containers = wrapper.findAll('.screen-container')
      const masks = wrapper.findAll('.mask-layer')

      expect(containers).toHaveLength(1)
      expect(masks).toHaveLength(1)
    })

    it('maskStyle 应返回覆盖全屏的绝对定位样式（无选区时无 clip-path）', async () => {
      const wrapper = createWrapper(singleDisplay, ['data:image/png;base64,test'])
      await waitForInit(wrapper)

      // maskStyle 不应包含 clipPath（无选区）
      const style = (wrapper.vm as any).maskStyle
      expect(style.position).toBe('absolute')
      expect(style.left).toBe('0')
      expect(style.top).toBe('0')
      expect(style.width).toBe('100%')
      expect(style.height).toBe('100%')
      expect(style.background).toContain('rgba')
      // 无选区状态下，maskStyle 不写 clipPath（默认 none）
      expect(style.clipPath).toBeUndefined()
    })

    it('选区状态下 maskStyle 应有 clip-path polygon 抠洞', async () => {
      const wrapper = createWrapper(singleDisplay, ['data:image/png;base64,test'])
      await waitForInit(wrapper)

      // 直接设置选区状态（onMounted 已初始化好 displays/virtualLeft/top）
      ;(wrapper.vm as any).isSelecting = true
      ;(wrapper.vm as any).selection = { x: 100, y: 100, width: 400, height: 300 }
      await wrapper.vm.$nextTick()

      const style = (wrapper.vm as any).maskStyle
      expect(style.clipPath).toBeDefined()
      expect(style.clipPath).toContain('polygon')
    })

    it('getDisplayStyle 应返回正确的定位', async () => {
      const wrapper = createWrapper(singleDisplay, ['data:image/png;base64,test'])
      await waitForInit(wrapper)

      const style = (wrapper.vm as any).getDisplayStyle(singleDisplay[0])
      expect(style.position).toBe('absolute')
      expect(style.left).toBe('0px')
      expect(style.top).toBe('0px')
      expect(style.width).toBe('1920px')
      expect(style.height).toBe('1080px')
    })
  })

  describe('双屏场景（左负坐标）', () => {
    it('应有 2 个 screen-container 和 1 个统一的 mask-layer', async () => {
      const wrapper = createWrapper(dualDisplays, ['img1', 'img2'])
      await waitForInit(wrapper)

      const containers = wrapper.findAll('.screen-container')
      const masks = wrapper.findAll('.mask-layer')

      expect(containers).toHaveLength(2)
      expect(masks).toHaveLength(1) // 统一蒙版，不是每个显示器一个
    })

    it('maskStyle 在双屏场景下仍为覆盖整个 panel 的 100% 尺寸', async () => {
      const wrapper = createWrapper(dualDisplays, ['img1', 'img2'])
      await waitForInit(wrapper)

      const style = (wrapper.vm as any).maskStyle
      expect(style.position).toBe('absolute')
      expect(style.left).toBe('0')
      expect(style.top).toBe('0')
      expect(style.width).toBe('100%')
      expect(style.height).toBe('100%')
    })

    it('getDisplayStyle 应正确计算各屏相对于 virtualLeft 的偏移', async () => {
      const wrapper = createWrapper(dualDisplays, ['img1', 'img2'])
      await waitForInit(wrapper)

      // onMounted → getAllScreens → calcVirtualScreen()
      // virtualLeft = min(-2048, 0) = -2048

      // 左屏: bounds.x=-2048, virtualLeft=-2048 → left = -2048 - (-2048) = 0
      const leftStyle = (wrapper.vm as any).getDisplayStyle(dualDisplays[0])
      expect(leftStyle.left).toBe('0px')
      expect(leftStyle.top).toBe('0px')
      expect(leftStyle.width).toBe('1920px')
      expect(leftStyle.height).toBe('1080px')

      // 右屏(主屏): bounds.x=0, virtualLeft=-2048 → left = 0 - (-2048) = 2048
      const rightStyle = (wrapper.vm as any).getDisplayStyle(dualDisplays[1])
      expect(rightStyle.left).toBe('2048px')
      expect(rightStyle.top).toBe('0px')
      expect(rightStyle.width).toBe('1920px')
      expect(rightStyle.height).toBe('1080px')
    })

    it('选区内 maskStyle 的 clip-path 应使用虚拟坐标系', async () => {
      const wrapper = createWrapper(dualDisplays, ['img1', 'img2'])
      await waitForInit(wrapper)

      // 设置选区（在左屏内部）
      ;(wrapper.vm as any).isSelecting = true
      ;(wrapper.vm as any).selection = { x: -1500, y: 100, width: 400, height: 300 }
      await wrapper.vm.$nextTick()

      // sx = -1500 - (-2048) = 548，完全在左屏内部
      const style = (wrapper.vm as any).maskStyle
      expect(style.clipPath).toBeDefined()
      expect(style.clipPath).toContain('polygon')
    })

    it('跨屏选区时 maskStyle 的 clip-path 应显示抠洞', async () => {
      const wrapper = createWrapper(dualDisplays, ['img1', 'img2'])
      await waitForInit(wrapper)

      // 跨屏选区：x=-100 到 x=100（左屏右边缘到右屏左边缘）
      // virtualLeft = -2048
      ;(wrapper.vm as any).isSelecting = true
      ;(wrapper.vm as any).selection = { x: -100, y: 100, width: 200, height: 300 }
      await wrapper.vm.$nextTick()

      // sx = -100 - (-2048) = 1948
      // 单蒙版 clip-path 使用虚拟坐标
      const style = (wrapper.vm as any).maskStyle
      expect(style.clipPath).toBeDefined()
      expect(style.clipPath).toContain('polygon')
    })
  })
})

describe('ScreenshotPanel.vue - calcVirtualScreen()', () => {
  it('单屏时 virtualLeft/virtualTop 应为 0', async () => {
    const wrapper = createWrapper([{
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      isPrimary: true,
      label: '主屏幕'
    }])
    await waitForInit(wrapper)

    // onMounted → calcVirtualScreen() 已自动调用
    expect(wrapper.vm.virtualLeft).toBe(0)
    expect(wrapper.vm.virtualTop).toBe(0)
  })

  it('双屏(左负坐标)时 virtualLeft 应为左屏的 x', async () => {
    const wrapper = createWrapper(dualDisplays, ['img1', 'img2'])
    await waitForInit(wrapper)

    expect(wrapper.vm.virtualLeft).toBe(-2048)
    expect(wrapper.vm.virtualTop).toBe(0)
    expect(wrapper.vm.virtualWidth).toBe(3968)   // 1920 + 2048
    expect(wrapper.vm.virtualHeight).toBe(1080)
  })

  it('空 displays 时所有 virtual 值归零', async () => {
    const wrapper = createWrapper([])
    await waitForInit(wrapper)

    expect(wrapper.vm.virtualLeft).toBe(0)
    expect(wrapper.vm.virtualTop).toBe(0)
    expect(wrapper.vm.virtualWidth).toBe(0)
    expect(wrapper.vm.virtualHeight).toBe(0)
  })
})

describe('ScreenshotPanel.vue - selectionStyle 选区指示器', () => {
  it('selectionStyle 应基于虚拟坐标计算 left/top', async () => {
    const wrapper = createWrapper(dualDisplays, ['img1', 'img2'])
    await waitForInit(wrapper)

    // virtualLeft = -2048
    // 设置选区：x=-100（在虚拟空间中实际位于左屏右部）
    ;(wrapper.vm as any).isSelecting = true
    ;(wrapper.vm as any).selection = { x: -100, y: 100, width: 200, height: 300 }
    await wrapper.vm.$nextTick()

    const style = (wrapper.vm as any).selectionStyle
    // left = -100 - (-2048) = 1948
    // top = 100 - 0 = 100
    expect(style.left).toBe('1948px')
    expect(style.top).toBe('100px')
    expect(style.width).toBe('200px')
    expect(style.height).toBe('300px')
    expect(style.border).toContain('2px')
  })
})
