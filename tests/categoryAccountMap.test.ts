import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// 1. 手動為 Node.js 測試環境 Mock 全域 localStorage
const store: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = String(value) },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const k in store) delete store[k] },
  length: 0,
  key: (index: number) => null
} as any

// 2. 引入 Composable
import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'
import { 
  useCategoryAccountMap, 
  formatRuleKey, 
  parseRuleKey 
} from '../src/composables/useCategoryAccountMap'

describe('🎯 分類預設帳戶自動對應與獨立成員記憶測試', () => {
  beforeEach(async () => {
    // 每個測試前清空 LocalStorage
    for (const key in store) {
      delete store[key]
    }
    
    const auth = useAuth()
    await auth.reloadProfiles()

    const ledger = useLedger()
    ledger.clearLedgerData()
  })

  afterEach(() => {
    const ledger = useLedger()
    ledger.clearLedgerData()
  })

  it('1. 驗證 formatRuleKey 與 parseRuleKey 轉換正確性', () => {
    expect(formatRuleKey('交通', '捷運')).toBe('交通 > 捷運')
    expect(formatRuleKey('交通', '')).toBe('交通')
    expect(formatRuleKey('  餐飲  ', '  午餐  ')).toBe('餐飲 > 午餐')

    const parsed1 = parseRuleKey('交通 > 捷運')
    expect(parsed1.category).toBe('交通')
    expect(parsed1.subCategory).toBe('捷運')

    const parsed2 = parseRuleKey('餐飲')
    expect(parsed2.category).toBe('餐飲')
    expect(parsed2.subCategory).toBeUndefined()
  })

  it('2. 支援「多成員獨立記憶」：我記 捷運->倫悠遊卡，老婆記 捷運->逗悠遊卡，互不干擾', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const map = useCategoryAccountMap()

    // 建立兩位家庭成員：我 (倫倫) 與 老婆
    const profileMe = await auth.createProfile('倫倫', '🐱')
    const profileWife = await auth.createProfile('老婆', '🐰')

    // 建立兩個悠遊卡帳戶
    auth.switchProfile(profileMe.id)
    await ledger.loadLedgerData()

    const accMeCard = await ledger.addAccount({
      name: '倫悠遊卡',
      type: 'electronic_ticket',
      balance: 500,
      icon: 'CreditCard',
      color: '#4ECDC4',
      currency: 'TWD'
    })

    const accWifeCard = await ledger.addAccount({
      name: '逗悠遊卡',
      type: 'electronic_ticket',
      balance: 800,
      icon: 'CreditCard',
      color: '#FF6B6B',
      currency: 'TWD'
    })

    // ─── 階段 A：以「倫倫」身分設定或學習 交通 > 捷運 ➔ 倫悠遊卡 ───
    auth.switchProfile(profileMe.id)
    await map.setRule('交通', '捷運', accMeCard.id)

    expect(map.getPreferredAccountId('交通', '捷運', 'expense')).toBe(accMeCard.id)

    // ─── 階段 B：切換為「老婆」身分，設定或學習 交通 > 捷運 ➔ 逗悠遊卡 ───
    auth.switchProfile(profileWife.id)
    await map.setRule('交通', '捷運', accWifeCard.id)

    expect(map.getPreferredAccountId('交通', '捷運', 'expense')).toBe(accWifeCard.id)

    // ─── 階段 C：切回「倫倫」身分，驗證依然是 倫悠遊卡 ───
    auth.switchProfile(profileMe.id)
    expect(map.getPreferredAccountId('交通', '捷運', 'expense')).toBe(accMeCard.id)
  })

  it('3. 階層 Fallback 機制：子分類優先，若無特定子分類則 Fallback 至主分類通用預設', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const map = useCategoryAccountMap()

    const profile = await auth.createProfile('測試使用者', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()

    const accCash = await ledger.addAccount({
      name: '皮夾現金',
      type: 'cash',
      balance: 2000,
      icon: 'Wallet',
      color: '#FFE6A7',
      currency: 'TWD'
    })

    const accCard = await ledger.addAccount({
      name: '玉山信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#6C5CE7',
      currency: 'TWD',
      cardDetails: { creditLimit: 50000, billingCycleDate: 10, paymentDueDate: 25 }
    })

    // 設定「餐飲」主分類預設為現金
    await map.setRule('餐飲', undefined, accCash.id)
    // 設定「餐飲 > 大餐」子分類預設為信用卡
    await map.setRule('餐飲', '大餐', accCard.id)

    // 查詢「餐飲 > 大餐」➔ 應精準命中信用卡
    expect(map.getPreferredAccountId('餐飲', '大餐', 'expense')).toBe(accCard.id)

    // 查詢「餐飲 > 午餐」➔ 無個別設定，應 Fallback 命中主分類現金
    expect(map.getPreferredAccountId('餐飲', '午餐', 'expense')).toBe(accCash.id)

    // 查詢「餐飲」主分類自身 ➔ 命中現金
    expect(map.getPreferredAccountId('餐飲', undefined, 'expense')).toBe(accCash.id)
  })

  it('4. 交易類型限制：收入不能自動帶入信用卡帳戶', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const map = useCategoryAccountMap()

    const profile = await auth.createProfile('測試使用者', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()

    const accCard = await ledger.addAccount({
      name: '台新信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#6C5CE7',
      currency: 'TWD',
      cardDetails: { creditLimit: 30000, billingCycleDate: 5, paymentDueDate: 20 }
    })

    // 綁定「其他收入」到信用卡
    await map.setRule('其他收入', '二手出售', accCard.id)

    // 支出時可回傳
    expect(map.getPreferredAccountId('其他收入', '二手出售', 'expense')).toBe(accCard.id)

    // 收入時因信用卡不可作為收款帳戶，應過濾回傳 null
    expect(map.getPreferredAccountId('其他收入', '二手出售', 'income')).toBeNull()
  })

  it('5. 帳戶有效性過濾：已被刪除或不存在的帳戶不予帶入', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const map = useCategoryAccountMap()

    const profile = await auth.createProfile('測試使用者', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()

    // 綁定一個幽靈帳戶 ID
    await map.setRule('娛樂休閒', '電影戲劇', 'non_existing_acc_id')

    expect(map.getPreferredAccountId('娛樂休閒', '電影戲劇', 'expense')).toBeNull()
  })

  it('6. 記帳時自動學習：呼叫 learnFromTransaction 後自動更新偏好', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const map = useCategoryAccountMap()

    const profile = await auth.createProfile('測試主人', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()

    const acc1 = await ledger.addAccount({
      name: '帳戶一',
      type: 'cash',
      balance: 1000,
      icon: 'Wallet',
      color: '#aaa',
      currency: 'TWD'
    })

    const acc2 = await ledger.addAccount({
      name: '帳戶二',
      type: 'cash',
      balance: 2000,
      icon: 'Wallet',
      color: '#bbb',
      currency: 'TWD'
    })

    // 模擬第一次記錄 交通 > 公車 ➔ 帳戶一
    await map.learnFromTransaction('交通', '公車', acc1.id)
    expect(map.getPreferredAccountId('交通', '公車', 'expense')).toBe(acc1.id)
    expect(map.getPreferredAccountId('交通', undefined, 'expense')).toBe(acc1.id)

    // 模擬使用者後來改用 帳戶二 記錄 交通 > 公車
    await map.learnFromTransaction('交通', '公車', acc2.id)
    expect(map.getPreferredAccountId('交通', '公車', 'expense')).toBe(acc2.id)
  })

  it('7. 從歷史記帳紀錄一鍵提煉 (extractFromHistory)：按時間排序提取最新帳戶', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const map = useCategoryAccountMap()

    const profile = await auth.createProfile('歷史分析者', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()

    const accOld = await ledger.addAccount({
      name: '舊錢包',
      type: 'cash',
      balance: 1000,
      icon: 'Wallet',
      color: '#111',
      currency: 'TWD'
    })

    const accNew = await ledger.addAccount({
      name: '新錢包',
      type: 'cash',
      balance: 3000,
      icon: 'Wallet',
      color: '#222',
      currency: 'TWD'
    })

    // 模擬過去有兩筆交易：
    // 第一筆 (較早)：餐飲 > 午餐 ➔ 使用 舊錢包
    // 第二筆 (較晚)：餐飲 > 午餐 ➔ 使用 新錢包
    await ledger.addTransaction({
      type: 'expense',
      amount: 100,
      category: '餐飲',
      subCategory: '午餐',
      fromAccountId: accOld.id,
      date: 1000,
      note: '早期的午餐',
      tags: []
    })

    await ledger.addTransaction({
      type: 'expense',
      amount: 150,
      category: '餐飲',
      subCategory: '午餐',
      fromAccountId: accNew.id,
      date: 2000,
      note: '最近的午餐',
      tags: []
    })

    // 執行一鍵提煉
    const count = await map.extractFromHistory()
    expect(count).toBeGreaterThan(0)

    // 驗證提煉出的帳戶為時間最新一筆的「新錢包」
    expect(map.getPreferredAccountId('餐飲', '午餐', 'expense')).toBe(accNew.id)
  })

  it('8. 手動管理功能：支援 removeRule 與 clearAllRules', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const map = useCategoryAccountMap()

    const profile = await auth.createProfile('管理員', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()

    const acc = await ledger.addAccount({
      name: '銀行存款',
      type: 'bank',
      balance: 10000,
      icon: 'Landmark',
      color: '#333',
      currency: 'TWD'
    })

    await map.setRule('薪資收入', undefined, acc.id)
    await map.setRule('投資理財', '股票股利', acc.id)

    expect(map.rulesList.value.length).toBe(2)

    // 刪除單筆規則
    await map.removeRule('薪資收入')
    expect(map.rulesList.value.length).toBe(1)
    expect(map.getPreferredAccountId('薪資收入', undefined, 'income')).toBeNull()

    // 清空全部規則
    await map.clearAllRules()
    expect(map.rulesList.value.length).toBe(0)
  })
})
