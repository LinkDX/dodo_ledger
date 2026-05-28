import { ref } from 'vue'

interface AlertState {
  isOpen: boolean
  title: string
  message: string
  okText: string
  resolve: (() => void) | null
}

const state = ref<AlertState>({
  isOpen: false,
  title: '🐱 喵！報告主人：',
  message: '',
  okText: '好喵🐾',
  resolve: null
})

export const useAlert = () => {
  const showAlert = (message: string, title?: string, options?: { okText?: string }) => {
    return new Promise<void>((res) => {
      state.value.message = message
      state.value.title = title || '🐱 喵！報告主人：'
      state.value.okText = options?.okText || '好喵🐾'
      state.value.resolve = res
      state.value.isOpen = true
    })
  }

  const handleAlert = () => {
    if (state.value.resolve) {
      state.value.resolve()
    }
    state.value.isOpen = false
    state.value.resolve = null
  }

  return {
    state,
    showAlert,
    handleAlert
  }
}
