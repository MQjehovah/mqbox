/**
 * ScreenshotPanel.vue 组件测试
 *
 * 重点测试：
 * - getMaskStyle() 多屏独立蒙版渲染
 * - getDisplayStyle() 各屏图片定位
 * - getSelectionStyle() 选区指示器
 * - calcVirtualScreen() 虚拟屏幕计算
 * - 初始状态（无蒙版）
 * - 选区中状态（蒙版抠洞）
 * - 双屏场景（左负坐标 + 主屏）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ScreenshotPanel from '@/components/ScreenshotPanel.vue'

// ====== 模拟 window.mqbox.screenshot API ======
beforeEach(() => {
  ;(window as any).mqbox = {
    screenshot: {
      capture: vi.fn(async () => 'data:image/png;base64,mocked'),
      cancel: vi.fn()
    }
  }
})

// ====== 辅组：创建带有指定 display 数据的组件 ======
function createWrapper(displays: any[], images: string[] = []) {
  return mount(ScreenshotPanel, {
    global: {
      stubs: {
        'img': true
      }
    },
    // 通过设置组件 data / props 来注入数据
    attachTo: document.body
  })
}

// ====== 测试 ======
describe('ScreenshotPanel.vue - 蒙版渲染', () => {

  describe('单屏场景', () => {
    it('初始状态应有 1 个 screen-container 和 1 个 screen-mask', async () => {
      const wrapper = createWrapper()
      // 需要等组件 mounted 后设置数据
      await wrapper.setData({
        displays: [{
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          scaleFactor: 1,
          isPrimary: true,
          label: '主屏幕'
        }],
        images: ['data:image/png;base64,test'],
        virtualLeft: 0,
        virtualTop: 0
      })
      await wrapper.vm.$nextTick()

      const containers = wrapper.findAll('.screen-container')
      const masks = wrapper.findAll('.screen-mask')

      expect(containers).toHaveLength(1)
      expect(masks).toHaveLength(1)
    })

    it('getMaskStyle 应返回覆盖全屏的固定定位样式', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: [{
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          scaleFactor: 1,
          isPrimary: true,
          label: '主屏幕'
        }],
        images: [],
        virtualLeft: 0,
        virtualTop: 0
      })
      await wrapper.vm.$nextTick()

      const style = (wrapper.vm as any).getMaskStyle(wrapper.vm.displays[0])

      expect(style.position).toBe('fixed')
      expect(style.left).toBe('0px')
      expect(style.top).toBe('0px')
      expect(style.width).toBe('1920px')
      expect(style.height).toBe('1080px')
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0.5)')
      expect(style.pointerEvents).toBe('none')
    })

    it('初始状态下（无选区）蒙版不应有 clip-path', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: [{
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          scaleFactor: 1,
          isPrimary: true,
          label: '主屏幕'
        }],
        images: [],
        virtualLeft: 0,
        virtualTop: 0,
        isSelecting: false,
        selection: { x: 0, y: 0, width: 0, height: 0 }
      })
      await wrapper.vm.$nextTick()

      const style = (wrapper.vm as any).getMaskStyle(wrapper.vm.displays[0])

      expect(style.clipPath).toBeUndefined()
    })

    it('选区状态下蒙版应有 clip-path 抠洞', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: [{
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          scaleFactor: 1,
          isPrimary: true,
          label: '主屏幕'
        }],
        images: [],
        virtualLeft: 0,
        virtualTop: 0,
        isSelecting: true,
        selection: { x: 100, y: 100, width: 400, height: 300 }
      })
      await wrapper.vm.$nextTick()

      const style = (wrapper.vm as any).getMaskStyle(wrapper.vm.displays[0])

      // clip-path 应存在且包含 inset，形成抠洞效果
      expect(style.clipPath).toBeDefined()
      expect(style.clipPath).toContain('polygon')
      // 抠洞区域坐标在屏幕内部，不应出现跨屏大数值
    })

    it('getDisplayStyle 应返回正确的定位', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: [{
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          scaleFactor: 1,
          isPrimary: true,
          label: '主屏幕'
        }],
        images: [],
        virtualLeft: 0,
        virtualTop: 0
      })
      await wrapper.vm.$nextTick()

      const style = (wrapper.vm as any).getDisplayStyle(wrapper.vm.displays[0])

      expect(style.position).toBe('fixed')
      expect(style.left).toBe('0px')
      expect(style.top).toBe('0px')
      expect(style.width).toBe('1920px')
      expect(style.height).toBe('1080px')
    })
  })

  describe('双屏场景(左负坐标) - 关键测试', () => {
    const dualDisplays = [
      {
        id: 1,
        bounds: { x: -2048, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        isPrimary: false,
        label: '左屏'
      },
      {
        id: 2,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        isPrimary: true,
        label: '右屏(主屏)'
      }
    ]

    it('双屏下应有 2 个 screen-container 和 2 个 screen-mask', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: dualDisplays,
        images: ['data:image/png;base64,left', 'data:image/png;base64,right'],
        virtualLeft: -2048,
        virtualTop: 0
      })
      await wrapper.vm.$nextTick()

      const containers = wrapper.findAll('.screen-container')
      const masks = wrapper.findAll('.screen-mask')

      expect(containers).toHaveLength(2)
      expect(masks).toHaveLength(2)
    })

    it('左屏蒙版应定位在相对 virtualLeft 偏移的正确位置', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: dualDisplays,
        images: [],
        virtualLeft: -2048,
        virtualTop: 0
      })
      await wrapper.vm.$nextTick()

      // 左屏: bounds.x=-2048, virtualLeft=-2048 → left = -2048 - (-2048) = 0
      const leftStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[0])
      expect(leftStyle.left).toBe('0px')
      expect(leftStyle.top).toBe('0px')
      expect(leftStyle.width).toBe('1920px')
      expect(leftStyle.height).toBe('1080px')

      // 右屏(主屏): bounds.x=0, virtualLeft=-2048 → left = 0 - (-2048) = 2048
      const rightStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[1])
      expect(rightStyle.left).toBe('2048px')
      expect(rightStyle.top).toBe('0px')
      expect(rightStyle.width).toBe('1920px')
      expect(rightStyle.height).toBe('1080px')
    })

    it('左屏选区时左屏蒙版应有 clip-path，右屏蒙版应全黑', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: dualDisplays,
        images: [],
        virtualLeft: -2048,
        virtualTop: 0,
        isSelecting: true,
        selection: { x: -1500, y: 100, width: 400, height: 300 }
      })
      await wrapper.vm.$nextTick()

      // 左屏蒙版：选区在左屏内部，应有 clip-path 抠洞
      const leftStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[0])
      expect(leftStyle.clipPath).toBeDefined()
      expect(leftStyle.clipPath).toContain('polygon')

      // 右屏蒙版：选区不在右屏内，clip-path 抠洞坐标应在右屏范围外，所以右屏全黑
      const rightStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[1])
      expect(rightStyle.clipPath).toBeDefined()
    })

    it('跨屏选区时两块蒙版都应显示抠洞', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: dualDisplays,
        images: [],
        virtualLeft: -2048,
        virtualTop: 0,
        isSelecting: true,
        selection: { x: -100, y: 100, width: 200, height: 300 }
      })
      await wrapper.vm.$nextTick()

      // 跨屏选区：x=-100 到 x=100，横跨左右两块屏幕
      const leftStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[0])
      expect(leftStyle.clipPath).toBeDefined()
      expect(leftStyle.clipPath).toContain('polygon')

      const rightStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[1])
      expect(rightStyle.clipPath).toBeDefined()
      expect(rightStyle.clipPath).toContain('polygon')
    })

    it('每块蒙版的 clip-path 坐标值应在合理范围内（不出现跨屏大数值）', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: dualDisplays,
        images: [],
        virtualLeft: -2048,
        virtualTop: 0,
        isSelecting: true,
        selection: { x: -100, y: 100, width: 200, height: 300 }
      })
      await wrapper.vm.$nextTick()

      // 左屏蒙版：其 clip-path 坐标应相对于左屏内部（0~1920 范围内）
      const leftStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[0])
      // 提取 polygon 中的数值，检查是否在合理范围
      const leftNumbers = leftStyle.clipPath.match(/\d+/g)?.map(Number) || []
      for (const n of leftNumbers) {
        expect(n).toBeLessThanOrEqual(2500) // 不应出现数千的跨屏大数值
      }

      // 右屏蒙版：其 clip-path 坐标应相对于右屏内部（0~1920 范围内）
      const rightStyle = (wrapper.vm as any).getMaskStyle(dualDisplays[1])
      const rightNumbers = rightStyle.clipPath.match(/\d+/g)?.map(Number) || []
      for (const n of rightNumbers) {
        expect(n).toBeLessThanOrEqual(2500) // 不应出现数千的跨屏大数值
      }
    })
  })

  describe('calcVirtualScreen()', () => {
    it('单屏时 virtualLeft/virtualTop 应为 0', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: [{
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          scaleFactor: 1,
          isPrimary: true,
          label: '主屏幕'
        }]
      })
      await wrapper.vm.$nextTick()

      ;(wrapper.vm as any).calcVirtualScreen()
      expect(wrapper.vm.virtualLeft).toBe(0)
      expect(wrapper.vm.virtualTop).toBe(0)
    })

    it('双屏(左负坐标)时 virtualLeft 应为左屏的 x', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({
        displays: [
          { id: 1, bounds: { x: -2048, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: false },
          { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }
        ]
      })
      await wrapper.vm.$nextTick()

      ;(wrapper.vm as any).calcVirtualScreen()
      expect(wrapper.vm.virtualLeft).toBe(-2048)
      expect(wrapper.vm.virtualTop).toBe(0)
    })

    it('空 displays 时 virtualLeft/virtualTop 应为 0', async () => {
      const wrapper = createWrapper()
      await wrapper.setData({ displays: [] })
      await wrapper.vm.$nextTick()

      ;(wrapper.vm as any).calcVirtualScreen()
      expect(wrapper.vm.virtualLeft).toBe(0)
      expect(wrapper.vm.virtualTop).toBe(0)
    })
  })

  describe('getSelectionStyle()', () => {
    it('选区样式应返回正确的 fixed 定位', async () => {
      const wrapper = createWrapper()
      // 设置 mousedown 后的状态
      wrapper.vm.isSelecting = true
      wrapper.vm.selection = { x: -1500, y: 100, width: 400, height: 300 }
      await wrapper.vm.$nextTick()

      const style = (wrapper.vm as any).getSelectionStyle()

      expect(style.position).toBe('fixed')
      expect(style.left).toBe('-1500px')
      expect(style.top).toBe('100px')
      expect(style.width).toBe('400px')
      expect(style.height).toBe('300px')
    })
  })
})
