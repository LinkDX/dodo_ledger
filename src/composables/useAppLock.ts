import { ref, computed } from 'vue'

// 1. 安全雜湊輔助函數：相容瀏覽器 Web Crypto API、非安全內網 HTTP 預覽與 Node.js 測試環境
function sha256PureJS(ascii: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount))
  const mathPow = Math.pow
  const maxWord = mathPow(2, 32)
  let result = ''

  const words: number[] = []
  const utf8 = unescape(encodeURIComponent(ascii))
  const asciiBitLength = utf8.length * 8

  const hash: number[] = []
  const k: number[] = []
  let primeCounter = 0

  const isComposite: Record<number, number> = {}
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0
    }
  }

  let str = utf8 + '\x80'
  while ((str.length % 64) - 56) str += '\x00'
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i)
    words[i >> 2] |= j << ((3 - (i % 4)) * 8)
  }
  words[words.length] = (asciiBitLength / maxWord) | 0
  words[words.length] = asciiBitLength

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16))
    const oldHash = hash.slice(0)

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15]
      const w2 = w[i - 2]

      const a = hash[0]
      const e = hash[4]
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0)

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))

      hash.unshift((temp1 + temp2) | 0)
      hash[4] = (hash[4] + temp1) | 0
      hash.pop()
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255
      result += (b < 16 ? '0' : '') + b.toString(16)
    }
  }
  return result
}

export async function sha256(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message)
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
  return sha256PureJS(message)
}

// 2. 本地儲存與 Session 暫存之常數鍵名
const LOCAL_LOCK_HASH_KEY = 'dodo_app_lock_hash'
const SESSION_AUTH_KEY = 'dodo_app_lock_session'
const APP_PERSISTENT_LOCK_KEY = 'dodo_app_lock_persistent_session'

// 3. 讀取打包編譯期注入之全域密碼雜湊 (適用於部署 GitHub Pages 之全域防存取鎖)
const isTestMode = typeof globalThis !== 'undefined' && (
  (globalThis as any).process?.env?.NODE_ENV === 'test' || 
  (globalThis as any).process?.env?.VITEST === 'true'
)
const GLOBAL_HASH = isTestMode ? '' : (import.meta.env.VITE_APP_PASSWORD_HASH || '').trim().toLowerCase()

// 4. 響應式狀態 (全域單例共享，確保各元件訂閱狀態一致)
const isLocked = ref(true)
const hasLocalPassword = ref(false)

// 5. 初始化鎖定狀態與防護設定 (相容 SSR 與 Node.js 測試環境，不強制綁定 window 變數)
const initLockState = () => {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') {
    isLocked.value = false
    return
  }

  // a. 優先檢查此分頁是否在 Session 中已通過驗證，或是否存有持久化免解鎖標記 (手機 App 環境專用)
  const sessionAuth = sessionStorage.getItem(SESSION_AUTH_KEY)
  const persistentAuth = localStorage.getItem(APP_PERSISTENT_LOCK_KEY)
  if (sessionAuth === 'unlocked' || persistentAuth === 'unlocked_authorized') {
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
        localStorage.setItem(APP_PERSISTENT_LOCK_KEY, 'unlocked_authorized')
        return true
      }
      return false
    }
    
    // b. 次要比對本地私有鎖
    const localHash = localStorage.getItem(LOCAL_LOCK_HASH_KEY)
    if (localHash && inputHash === localHash) {
      isLocked.value = false
      sessionStorage.setItem(SESSION_AUTH_KEY, 'unlocked')
      localStorage.setItem(APP_PERSISTENT_LOCK_KEY, 'unlocked_authorized')
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
    
    // 設定成功後，直接讓當前 Session 與本地持久化處於已解鎖狀態
    isLocked.value = false
    sessionStorage.setItem(SESSION_AUTH_KEY, 'unlocked')
    localStorage.setItem(APP_PERSISTENT_LOCK_KEY, 'unlocked_authorized')
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
      localStorage.removeItem(APP_PERSISTENT_LOCK_KEY)
      hasLocalPassword.value = false
      isLocked.value = false
      // 同步清除解鎖 Session 與持久化標籤
      sessionStorage.removeItem(SESSION_AUTH_KEY)
      return true
    }
    
    return false
  }

  /**
   * 手動重新鎖定應用 (例如登出或手動鎖定)
   */
  const lockApp = () => {
    if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') return
    isLocked.value = true
    sessionStorage.removeItem(SESSION_AUTH_KEY)
    localStorage.removeItem(APP_PERSISTENT_LOCK_KEY)
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
