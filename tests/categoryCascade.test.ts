import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const store: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = String(value) },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const k in store) delete store[k] },
  length: 0,
  key: (index: number) => null
} as any

import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'

describe('🏷️ 分類管理原地編輯與歷史交易級聯更新測試 (SPEC 3.2.4)', () => {
  beforeEach(async () => {
    for (const k in store) delete store[k]
    const auth = useAuth()
    await auth.reloadProfiles()

    const ledger = useLedger()
    ledger.clearLedgerData()
  })

  afterEach(() => {
    const ledger = useLedger()
    ledger.clearLedgerData()
  })

  it('1. 主分類重命名時，歷史交易與週期記帳自動級聯同步更新 (Cascading Update)', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('分類測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const acc = await ledger.addAccount({
      name: '日常錢包',
      type: 'cash',
      balance: 10000,
      icon: 'Wallet',
      color: '#fff',
      currency: 'TWD'
    })

    // 建立 2 筆「餐飲」分類的交易
    await ledger.addTransaction({
      type: 'expense',
      amount: 120,
      category: '餐飲',
      subCategory: '午餐',
      fromAccountId: acc.id,
      date: Date.now(),
      note: '麥當勞',
      tags: []
    })

    await ledger.addTransaction({
      type: 'expense',
      amount: 250,
      category: '餐飲',
      subCategory: '晚餐',
      fromAccountId: acc.id,
      date: Date.now(),
      note: '火鍋',
      tags: []
    })

    // 建立 1 筆「餐飲」分類的週期記帳
    await ledger.addRecurring({
      title: '每日午餐津貼',
      type: 'expense',
      amount: 150,
      category: '餐飲',
      subCategory: '午餐',
      fromAccountId: acc.id,
      frequency: 'daily',
      nextExecutionDate: Date.now() + 86400000
    })

    // 找到「餐飲」分類的 ID
    const foodCat = ledger.categories.value.find(c => c.name === '餐飲')
    expect(foodCat).toBeDefined()

    // 將「餐飲」原地更名為「美食珍饈」
    await ledger.editCategory(foodCat!.id, {
      name: '美食珍饈',
      icon: 'Utensils'
    })

    // 驗證 A：分類本體名稱已更新
    const updatedCat = ledger.categories.value.find(c => c.id === foodCat!.id)
    expect(updatedCat?.name).toBe('美食珍饈')

    // 驗證 B：所有歷史交易的 category 欄位均自動級聯更新為「美食珍饈」
    const txs = ledger.transactions.value
    expect(txs.length).toBe(2)
    expect(txs.every(tx => tx.category === '美食珍饈')).toBe(true)

    // 驗證 C：週期記帳的 category 欄位亦自動級聯更新
    const recs = ledger.recurringTransactions.value
    expect(recs.length).toBe(1)
    expect(recs[0].category === '美食珍饈').toBe(true)
  })

  it('2. 子分類重命名時，歷史交易與週期記帳精準級聯更新', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('子分類測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const acc = await ledger.addAccount({
      name: '悠遊卡',
      type: 'electronic_ticket',
      balance: 500,
      icon: 'CreditCard',
      color: '#4ECDC4',
      currency: 'TWD'
    })

    // 記錄兩筆交通：一筆「捷運/公車」，一筆「計程車」
    await ledger.addTransaction({
      type: 'expense',
      amount: 30,
      category: '交通',
      subCategory: '捷運/公車',
      fromAccountId: acc.id,
      date: Date.now(),
      note: '搭捷運到台北車站',
      tags: []
    })

    await ledger.addTransaction({
      type: 'expense',
      amount: 200,
      category: '交通',
      subCategory: '計程車',
      fromAccountId: acc.id,
      date: Date.now(),
      note: '趕時間搭小黃',
      tags: []
    })

    const transCat = ledger.categories.value.find(c => c.name === '交通')
    expect(transCat).toBeDefined()

    // 將「捷運/公車」子分類更名為「大眾運輸」
    await ledger.editSubCategory(transCat!.id, '捷運/公車', '大眾運輸')

    // 驗證子分類陣列已更新
    const updatedCat = ledger.categories.value.find(c => c.id === transCat!.id)
    expect(updatedCat?.subCategories).toContain('大眾運輸')
    expect(updatedCat?.subCategories).not.toContain('捷運/公車')

    // 驗證歷史交易：「捷運/公車」變為「大眾運輸」，而「計程車」保持不變
    const tx1 = ledger.transactions.value.find(tx => tx.note.includes('搭捷運'))
    const tx2 = ledger.transactions.value.find(tx => tx.note.includes('搭小黃'))
    expect(tx1?.subCategory).toBe('大眾運輸')
    expect(tx2?.subCategory).toBe('計程車')
  })

  it('3. 新增主分類與子分類', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('新增分類測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 新增主分類「毛孩開銷」
    await ledger.addCategory({
      name: '毛孩開銷',
      type: 'expense',
      icon: 'Sparkles',
      subCategories: ['罐頭乾糧', '玩具貓砂']
    })

    const cat = ledger.categories.value.find(c => c.name === '毛孩開銷')
    expect(cat).toBeDefined()
    expect(cat?.subCategories.length).toBe(2)

    // 追加子分類「看醫生打疫苗」
    await ledger.addSubCategory(cat!.id, '看醫生打疫苗')

    const updatedCat = ledger.categories.value.find(c => c.id === cat!.id)
    expect(updatedCat?.subCategories).toContain('看醫生打疫苗')
  })

  it('4. 刪除子分類 (deleteSubCategory)', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('刪除子分類測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const cat = ledger.categories.value.find(c => c.name === '餐飲')
    expect(cat?.subCategories).toContain('買菜食材')

    await ledger.deleteSubCategory(cat!.id, '買菜食材')

    const updated = ledger.categories.value.find(c => c.id === cat!.id)
    expect(updated?.subCategories).not.toContain('買菜食材')
  })
})
