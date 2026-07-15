/**
 * Everything 插件配置组件单元测试
 *
 * 测试目标：plugins/builtin/everything/src/Config.vue
 * - 属性初始化和传递
 * - 表单输入绑定
 * - 字段校验（端口、超时、最大结果数）
 * - 保存操作
 * - 错误状态和加载状态展示
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfigComponent from '../../../../plugins/builtin/everything/src/Config.vue'

describe('Everything 配置组件', () => {
  let execute: ReturnType<typeof vi.fn>
  let close: ReturnType<typeof vi.fn>

  beforeEach(() => {
    execute = vi.fn().mockResolvedValue(undefined)
    close = vi.fn()
  })

  describe('属性传递与初始渲染', () => {
    it('应使用 props.data 中的值初始化表单字段', () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 27000, timeout: 3000, maxResults: 50 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      expect(inputs).toHaveLength(3)
      // @vue/test-utils 中 v-model.number 会转换为数字
      expect((inputs[0].element as HTMLInputElement).value).toBe('27000')
      expect((inputs[1].element as HTMLInputElement).value).toBe('3000')
      expect((inputs[2].element as HTMLInputElement).value).toBe('50')
    })

    it('props.data 为空时应使用默认值', () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: {} as any,
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      expect((inputs[0].element as HTMLInputElement).value).toBe('26983')
      expect((inputs[1].element as HTMLInputElement).value).toBe('3000')
      expect((inputs[2].element as HTMLInputElement).value).toBe('20')
    })

    it('应渲染标题"Everything 搜索 - 设置"', () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      expect(wrapper.text()).toContain('Everything 搜索 - 设置')
    })

    it('关闭按钮点击时应调用 close 函数', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const closeBtn = wrapper.find('button')
      await closeBtn.trigger('click')
      expect(close).toHaveBeenCalledOnce()
    })
  })

  describe('字段校验', () => {
    it('端口为 0 时应显示错误提示', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[0].setValue(0)
      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      expect(wrapper.text()).toContain('端口号必须在 1 ~ 65535 之间')
      expect(execute).not.toHaveBeenCalled()
    })

    it('端口为 65536 时应显示错误提示', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[0].setValue(65536)
      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      expect(wrapper.text()).toContain('端口号必须在 1 ~ 65535 之间')
      expect(execute).not.toHaveBeenCalled()
    })

    it('超时时间低于 500ms 时应显示错误提示', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[1].setValue(100)
      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      expect(wrapper.text()).toContain('超时时间不能低于 500ms')
      expect(execute).not.toHaveBeenCalled()
    })

    it('超时时间为 500ms 时应通过校验', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[1].setValue(500)
      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      expect(wrapper.text()).not.toContain('超时时间不能低于 500ms')
    })

    it('最大结果数为 0 时应显示错误提示', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[2].setValue(0)
      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      expect(wrapper.text()).toContain('最大结果数必须在 1 ~ 500 之间')
      expect(execute).not.toHaveBeenCalled()
    })

    it('最大结果数为 501 时应显示错误提示', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[2].setValue(501)
      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      expect(wrapper.text()).toContain('最大结果数必须在 1 ~ 500 之间')
      expect(execute).not.toHaveBeenCalled()
    })

    it('多项校验同时失败时应显示第一条错误消息', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[0].setValue(0)   // 端口无效
      await inputs[1].setValue(100) // 超时无效
      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      // 端口校验在前，应显示端口错误
      expect(wrapper.text()).toContain('端口号必须在 1 ~ 65535 之间')
    })
  })

  describe('保存操作', () => {
    it('校验通过时应调用 execute 保存配置', async () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const inputs = wrapper.findAll('input[type="number"]')
      await inputs[0].setValue(27000)
      await inputs[1].setValue(3000)
      await inputs[2].setValue(50)

      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      expect(execute).toHaveBeenCalledWith('saveConfig', {
        port: 27000,
        timeout: 3000,
        maxResults: 50
      })
    })

    it('保存成功时应更新按钮状态（不包含更新后文本，仅验证不抛错）', async () => {
      execute.mockResolvedValue(undefined)
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')

      // 等待异步操作完成
      await wrapper.vm.$nextTick()
      // 不抛异常即通过
    })

    it('execute 抛出异常时应显示错误信息', async () => {
      execute.mockRejectedValue(new Error('Connection timeout'))
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const saveBtn = wrapper.findAll('button').filter(b => b.text().includes('保存'))[0]
      await saveBtn.trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('保存失败')
    })
  })

  describe('输入字段属性', () => {
    it('端口输入框应设置 min=1 max=65535', () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const portInput = wrapper.findAll('input[type="number"]')[0]
      expect(portInput.attributes('min')).toBe('1')
      expect(portInput.attributes('max')).toBe('65535')
    })

    it('超时输入框应设置 min=500', () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const timeoutInput = wrapper.findAll('input[type="number"]')[1]
      expect(timeoutInput.attributes('min')).toBe('500')
    })

    it('最大结果数输入框应设置 min=1 max=500', () => {
      const wrapper = mount(ConfigComponent, {
        props: {
          data: { port: 26983, timeout: 5000, maxResults: 100 },
          execute,
          close
        }
      })

      const maxResultsInput = wrapper.findAll('input[type="number"]')[2]
      expect(maxResultsInput.attributes('min')).toBe('1')
      expect(maxResultsInput.attributes('max')).toBe('500')
    })
  })
})
