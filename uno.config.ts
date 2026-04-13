import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  shortcuts: {
    'flex-center': 'flex justify-center items-center',
    'flex-between': 'flex justify-between items-center',
    'text-primary': 'text-[#1E1E1E]',
    'text-secondary': 'text-[#666666]',
    'text-muted': 'text-[#999999]',
    'bg-primary': 'bg-[#0078D4]',
    'bg-card': 'bg-[#F5F5F5]',
    'border-light': 'border-[#E0E0E0]'
  },
  theme: {
    colors: {
      primary: '#0078D4',
      secondary: '#666666',
      muted: '#999999',
      card: '#F5F5F5',
      border: '#E0E0E0'
    }
  }
})