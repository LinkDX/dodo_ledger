import { ref, computed } from 'vue'

// 1. 安全雜湊輔助函數：相容瀏覽器 Web Crypto API 與 Node.js 測試環境
export async function sha256(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
  
  // 針對 Node.js (Vitest 測試) 的動態 Fallback
  try {
    const cryptoModule = await import('crypto' as any)
    return cryptoModule.createHash('sha256').update(message).digest('hex')
  } catch (e) {
    // 簡易降級 Hash (兜底防護)
    let hash = 0
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return 'fallback_' + Math.abs(hash).toString(16)
  }
}

// 2. 本地儲存與 Session 暫存之常數鍵名
const LOCAL_LOCK_HASH_KEY = 'dodo_app_lock_hash'
const SESSION_AUTH_KEY = 'dodo_app_lock_session'

// 3. 讀取打包編譯期注入之全域密碼雜湊 (適用於部署 GitHub Pages 之全域防存取鎖)
const GLOBAL_HASH = (import.meta.env.VITE_APP_PASSWORD_HASH || '').trim().toLowerCase()

// 4. 響應式狀態 (全域單例共享，確保各元件訂閱狀態一致)
const isLocked = ref(true)
const hasLocalPassword = ref(false)

// 5. 初始化鎖定狀態與防護設定 (相容 SSR 與 Node.js 測試環境，不強制綁定 window 變數)
const initLockState = () => {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') {
    isLocked.value = false
    return
  }

  // a. 優先檢查此分頁是否在 Session 中已通過驗證
  const sessionAuth = sessionStorage.getItem(SESSION_AUTH_KEY)
  if (sessionAuth === 'unlocked') {
    isLocked.value = false
    hasLocalPassword.value = !!localStorage.getItem(LOCAL_LOCK_HASH_KEY)
    return
  }

  // b. 檢查是否具備全域環境變數鎖
  const isGlobalEnabled = !!GLOBAL_HASH

  // c. 檢查是否具備本地私有鎖
  const localHash = localStorage.getItem(LOCAL_LOCK_HASH_KEY)
  hasLocalPassword.value = !!localHash

  // d. 若任一鎖定啟用，則初始狀態為鎖定；若均未啟用，則免鎖定進入系統
  if (isGlobalEnabled || localHash) {
    isLocked.value = true
  } else {
    isLocked.value = false
  }
}

// 立即執行初始狀態判斷
initLockState()

export function useAppLock() {
  
  // 是否啟用了全域環境變數鎖
  const isGlobalLockEnabled = computed(() => !!GLOBAL_HASH)

  /**
   * 驗證輸入的密碼
   * @param password 訪客輸入的明文密碼
   * @returns 驗證成功返回 true，否則 false
   */
  const verifyPassword = async (password: string): Promise<boolean> => {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return false
    
    const inputHash = await sha256(password)
    
    // a. 優先比對全域鎖
    if (isGlobalLockEnabled.value) {
      if (inputHash === GLOBAL_HASH) {
        isLocked.value = false
        sessionStorage.setItem(SESSION_AUTH_KEY, 'unlocked')
        return true
      }
      return false
    }
    
    // b. 次要比對本地私有鎖
    const localHash = localStorage.getItem(LOCAL_LOCK_HASH_KEY)
    if (localHash && inputHash === localHash) {
      isLocked.value = false
      sessionStorage.setItem(SESSION_AUTH_KEY, 'unlocked')
      return true
    }
    
    return false
  }

  /**
   * 啟用/設定新的本地私有鎖密碼
   * @param password 新密碼
   */
  const setupLocalPassword = async (password: string): Promise<void> => {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return
    
    const inputHash = await sha256(password)
    localStorage.setItem(LOCAL_LOCK_HASH_KEY, inputHash)
    hasLocalPassword.value = true
    
    // 設定成功後，直接讓當前 Session 處於已解鎖狀態
    isLocked.value = false
    sessionStorage.setItem(SESSION_AUTH_KEY, 'unlocked')
  }

  /**
   * 停用本地私有鎖 (需要輸入原密碼進行安全驗證)
   * @param password 原密碼
   * @returns 成功停用返回 true，否則 false
   */
  const disableLocalPassword = async (password: string): Promise<boolean> => {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return false
    
    const inputHash = await sha256(password)
    const localHash = localStorage.getItem(LOCAL_LOCK_HASH_KEY)
    
    if (localHash && inputHash === localHash) {
      localStorage.removeItem(LOCAL_LOCK_HASH_KEY)
      hasLocalPassword.value = false
      isLocked.value = false
      // 同步清除解鎖 Session
      sessionStorage.removeItem(SESSION_AUTH_KEY)
      return true
    }
    
    return false
  }

  /**
   * 手動重新鎖定應用 (例如登出或手動鎖定)
   */
  const lockApp = () => {
    if (typeof sessionStorage === 'undefined') return
    isLocked.value = true
    sessionStorage.removeItem(SESSION_AUTH_KEY)
  }

  return {
    isLocked: computed(() => isLocked.value),
    hasLocalPassword: computed(() => hasLocalPassword.value),
    isGlobalLockEnabled,
    verifyPassword,
    setupLocalPassword,
    disableLocalPassword,
    lockApp,
    reloadLockState: initLockState
  }
}
