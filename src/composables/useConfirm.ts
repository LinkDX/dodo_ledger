import { ref } from 'vue'

interface ConfirmState {
  isOpen: boolean
  title: string
  message: string
  okText: string
  cancelText: string
  resolve: ((val: boolean) => void) | null
}

const state = ref<ConfirmState>({
  isOpen: false,
  title: '🐱 喵？確定要執行嗎？',
  message: '',
  okText: '確定',
  cancelText: '取消',
  resolve: null
})

export const useConfirm = () => {
  const showConfirm = (message: string, title?: string, options?: { okText?: string; cancelText?: string }) => {
    return new Promise<boolean>((res) => {
      state.value.message = message
      state.value.title = title || '🐱 喵？確定要執行嗎？'
      state.value.okText = options?.okText || '確定🐾'
      state.value.cancelText = options?.cancelText || '取消'
      state.value.resolve = res
      state.value.isOpen = true
    })
  }

  const handleConfirm = (val: boolean) => {
    if (state.value.resolve) {
      state.value.resolve(val)
    }
    state.value.isOpen = false
    state.value.resolve = null
  }

  return {
    state,
    showConfirm,
    handleConfirm
  }
}
