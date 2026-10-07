import { describe, it, expect, beforeEach } from 'vitest'

// 1. Mock 全域 localStorage
const store: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = String(value) },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const k in store) delete store[k] },
  length: 0,
  key: (index: number) => null
} as any

// 2. 引入 useAuth 與 DEFAULT_CATEGORIES
import { useAuth, DEFAULT_CATEGORIES } from '../src/composables/useAuth'

describe('👤 useAuth - 使用者身分管理與設定測試', () => {
  beforeEach(async () => {
    for (const k in store) delete store[k]
    const auth = useAuth()
    await auth.reloadProfiles()
  })

  it('1. 驗證 DEFAULT_CATEGORIES 預設分類庫符合規格', () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThanOrEqual(9)

    // 支出分類涵蓋餐飲、交通、居住生活等
    const foodCat = DEFAULT_CATEGORIES.find(c => c.name === '餐飲')
    expect(foodCat).toBeDefined()
    expect(foodCat?.type).toBe('expense')
    expect(foodCat?.subCategories).toContain('早餐')
    expect(foodCat?.subCategories).toContain('午餐')

    const transCat = DEFAULT_CATEGORIES.find(c => c.name === '交通')
    expect(transCat).toBeDefined()
    expect(transCat?.subCategories).toContain('捷運/公車')

    // 收入分類涵蓋薪資、投資等
    const salaryCat = DEFAULT_CATEGORIES.find(c => c.name === '薪資收入')
    expect(salaryCat).toBeDefined()
    expect(salaryCat?.type).toBe('income')
  })

  it('2. 建立新成員 Profile 並自動切換登入', async () => {
    const auth = useAuth()

    const newProfile = await auth.createProfile('逗逗貓主人', '🐱')
    expect(newProfile.id).toBeDefined()
    expect(newProfile.name).toBe('逗逗貓主人')
    expect(newProfile.avatar).toBe('🐱')
    expect(newProfile.settings.monthlyBudget).toBe(20000)
    expect(newProfile.settings.currency).toBe('TWD')

    // 自動切換為當前登入身分
    expect(auth.isLoggedIn.value).toBe(true)
    expect(auth.currentProfile.value?.id).toBe(newProfile.id)
  })

  it('3. 切換身分 (switchProfile) 與登出 (logout)', async () => {
    const auth = useAuth()

    const userA = await auth.createProfile('主人A', '🐱')
    const userB = await auth.createProfile('主人B', '🐰')

    expect(auth.profiles.value.length).toBe(2)

    // 切換回主人 A
    auth.switchProfile(userA.id)
    expect(auth.currentProfile.value?.id).toBe(userA.id)
    expect(auth.currentProfile.value?.name).toBe('主人A')

    // 切換至主人 B
    auth.switchProfile(userB.id)
    expect(auth.currentProfile.value?.id).toBe(userB.id)
    expect(auth.currentProfile.value?.name).toBe('主人B')

    // 登出
    auth.logout()
    expect(auth.isLoggedIn.value).toBe(false)
    expect(auth.currentProfile.value).toBeNull()
  })

  it('4. 更新預算設定 (updateProfileSettings)', async () => {
    const auth = useAuth()
    const user = await auth.createProfile('預算測試者', '🐱')
    auth.switchProfile(user.id)

    expect(auth.currentProfile.value?.settings.monthlyBudget).toBe(20000)

    // 更新每月預算至 35000
    await auth.updateProfileSettings({ monthlyBudget: 35000 })
    expect(auth.currentProfile.value?.settings.monthlyBudget).toBe(35000)

    // 驗證持久化是否儲存
    const savedInStore = JSON.parse(store['dodo_ledger_profiles'] || '[]')
    const savedUser = savedInStore.find((p: any) => p.id === user.id)
    expect(savedUser.settings.monthlyBudget).toBe(35000)
  })

  it('5. 更換頭像 (updateProfileAvatar)', async () => {
    const auth = useAuth()
    const user = await auth.createProfile('頭像測試者', '🐱')
    auth.switchProfile(user.id)

    expect(auth.currentProfile.value?.avatar).toBe('🐱')

    await auth.updateProfileAvatar('🦁')
    expect(auth.currentProfile.value?.avatar).toBe('🦁')
  })

  it('6. 刪除身分 (deleteProfile) 同步清除相關緩存', async () => {
    const auth = useAuth()
    const userA = await auth.createProfile('即將被刪除者', '🐱')
    const userB = await auth.createProfile('保留者', '🐰')

    auth.switchProfile(userA.id)
    store[`dodo_ledger_${userA.id}_accounts`] = 'some_data'

    // 刪除 userA
    await auth.deleteProfile(userA.id)

    expect(auth.profiles.value.some(p => p.id === userA.id)).toBe(false)
    expect(auth.profiles.value.some(p => p.id === userB.id)).toBe(true)

    // 登出或切換
    expect(auth.currentProfile.value).toBeNull()
    // 本地專屬快取應被移除
    expect(store[`dodo_ledger_${userA.id}_accounts`]).toBeUndefined()
  })
})
