import { describe, it, expect, beforeEach, vi } from 'vitest'

// 1. 手動模擬全域 localStorage
const localStore: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => localStore[key] || null,
  setItem: (key: string, value: string) => { localStore[key] = String(value) },
  removeItem: (key: string) => { delete localStore[key] },
  clear: () => { for (const k in localStore) delete localStore[k] },
  length: 0,
  key: (index: number) => null
} as any

// 2. 手動模擬全域 sessionStorage
const sessionStore: Record<string, string> = {}
global.sessionStorage = {
  getItem: (key: string) => sessionStore[key] || null,
  setItem: (key: string, value: string) => { sessionStore[key] = String(value) },
  removeItem: (key: string) => { delete sessionStore[key] },
  clear: () => { for (const k in sessionStore) delete sessionStore[k] },
  length: 0,
  key: (index: number) => null
} as any

// 3. 引入 Composable 與 sha256 算法
import { useAppLock, sha256 } from '../src/composables/useAppLock'

describe('🔒 Dodo Gatekeeper - 雙層安全認證機制測試', () => {

  beforeEach(() => {
    // 每個測試前清空儲存體
    for (const key in localStore) delete localStore[key]
    for (const key in sessionStore) delete sessionStore[key]
    
    // 重置 useAppLock 內部狀態
    const { reloadLockState } = useAppLock()
    reloadLockState()
  })

  it('1. 驗證 SHA-256 單向雜湊算法正確性', async () => {
    const text = 'dodo520'
    const hash = await sha256(text)
    
    expect(hash).toBeDefined()
    expect(hash.length).toBe(64) // SHA-256 十六進位字串長度固定為 64
    
    // 相同的輸入應該產生相同的 Hash
    const hashAgain = await sha256(text)
    expect(hashAgain).toBe(hash)
    
    // 不同的輸入產生不同的 Hash
    const hashDifferent = await sha256('dodo521')
    expect(hashDifferent).not.toBe(hash)
  })

  it('2. 預設無任何鎖時，預設解鎖狀態', () => {
    const { isLocked, hasLocalPassword, isGlobalLockEnabled } = useAppLock()
    
    expect(isGlobalLockEnabled.value).toBe(false)
    expect(hasLocalPassword.value).toBe(false)
    expect(isLocked.value).toBe(false) // 預設未設定任何鎖時，不攔截使用者
  })

  it('3. 支援「本地私有密碼鎖」之啟用、驗證與解鎖', async () => {
    const { isLocked, hasLocalPassword, setupLocalPassword, verifyPassword, lockApp } = useAppLock()
    
    // 啟用本地密碼鎖 1234
    await setupLocalPassword('1234')
    expect(hasLocalPassword.value).toBe(true)
    expect(isLocked.value).toBe(false) // 設定成功後，當前 session 預設解鎖
    
    // 手動鎖定 App
    lockApp()
    expect(isLocked.value).toBe(true) // 進入鎖定狀態
    
    // 驗證錯誤密碼，應保持鎖定
    const failRes = await verifyPassword('0000')
    expect(failRes).toBe(false)
    expect(isLocked.value).toBe(true)
    
    // 驗證正確密碼，應解鎖
    const successRes = await verifyPassword('1234')
    expect(successRes).toBe(true)
    expect(isLocked.value).toBe(false)
  })

  it('4. 支援「本地私有密碼鎖」之停用 (需輸入原密碼安全核對)', async () => {
    const { hasLocalPassword, setupLocalPassword, disableLocalPassword } = useAppLock()
    
    await setupLocalPassword('5678')
    expect(hasLocalPassword.value).toBe(true)
    
    // 輸入錯誤密碼，無法關閉
    const failRes = await disableLocalPassword('0000')
    expect(failRes).toBe(false)
    expect(hasLocalPassword.value).toBe(true)
    
    // 輸入正確密碼，成功關閉
    const successRes = await disableLocalPassword('5678')
    expect(successRes).toBe(true)
    expect(hasLocalPassword.value).toBe(false)
  })

  it('5. 支援 Session 暫存，重新整理免重打密碼，提升使用者體驗', async () => {
    const { isLocked, setupLocalPassword, reloadLockState } = useAppLock()
    
    // 1. 設定密碼並完成解鎖
    await setupLocalPassword('9999')
    
    // 2. 模擬使用者重新整理網頁 (會觸發 reloadLockState 重新初始化)
    reloadLockState()
    
    // 3. 由於 sessionStorage 已經有 'unlocked'，應維持解鎖狀態，免重新輸入！
    expect(isLocked.value).toBe(false)
  })
})
