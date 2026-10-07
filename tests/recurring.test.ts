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

describe('⏰ 週期性自動記帳演算法與 Lazy-check 機制測試 (SPEC 3.3)', () => {
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

  it('1. 週期規則 CRUD：新增、編輯、切換啟用與刪除', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('週期測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const acc = await ledger.addAccount({
      name: '銀行戶頭',
      type: 'bank',
      balance: 50000,
      icon: 'Landmark',
      color: '#fff',
      currency: 'TWD'
    })

    // 新增一筆房租每月週期扣款
    const now = Date.now()
    await ledger.addRecurring({
      title: '每月房租',
      type: 'expense',
      amount: 15000,
      category: '居住生活',
      subCategory: '房租/房貸',
      fromAccountId: acc.id,
      frequency: 'monthly',
      interval: 1,
      startDate: now,
      nextExecutionDate: now + 86400000
    })

    expect(ledger.recurringTransactions.value.length).toBe(1)
    const rule = ledger.recurringTransactions.value[0]
    expect(rule.title).toBe('每月房租')
    expect(rule.isActive).toBe(true)

    // 切換為停用
    await ledger.toggleRecurringActive(rule.id)
    expect(ledger.recurringTransactions.value[0].isActive).toBe(false)

    // 重新啟用
    await ledger.toggleRecurringActive(rule.id)
    expect(ledger.recurringTransactions.value[0].isActive).toBe(true)

    // 刪除規則
    await ledger.deleteRecurring(rule.id)
    expect(ledger.recurringTransactions.value.length).toBe(0)
  })

  it('2. 週期記帳自動觸發機制 (checkAndTriggerRecurring)：到期自動扣款並推移下次執行日', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('觸發測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const acc = await ledger.addAccount({
      name: '主力錢包',
      type: 'cash',
      balance: 10000,
      icon: 'Wallet',
      color: '#fff',
      currency: 'TWD'
    })

    // 設定一筆「過去已經到期」的每日定額訂閱 (例如昨天的時間戳記)
    const yesterday = Date.now() - 3600000 // 1小時前
    await ledger.addRecurring({
      title: '影音串流月租',
      type: 'expense',
      amount: 300,
      category: '娛樂休閒',
      subCategory: '訂閱服務',
      fromAccountId: acc.id,
      frequency: 'daily',
      interval: 1,
      startDate: yesterday,
      nextExecutionDate: yesterday
    })

    // 驗證 A：addRecurring 內建 Lazy-check 已自動補執行一筆支出交易
    expect(ledger.transactions.value.length).toBe(1)
    const tx = ledger.transactions.value[0]
    expect(tx.amount).toBe(300)
    expect(tx.category).toBe('娛樂休閒')
    expect(tx.isRecurring).toBe(true)

    // 驗證 B：帳戶餘額已即時扣除
    const updatedAcc = ledger.accounts.value.find(a => a.id === acc.id)
    expect(updatedAcc?.balance).toBe(9700)

    // 驗證 C：週期下次執行時間已向後推移
    const updatedRule = ledger.recurringTransactions.value[0]
    expect(updatedRule.nextExecutionDate).toBeGreaterThan(Date.now())

    // 驗證 D：再次手動觸發時，因為尚未到達下次執行時間，不應重複扣款 (冪等性防呆)
    await ledger.checkAndTriggerRecurring()
    expect(ledger.transactions.value.length).toBe(1)
    expect(ledger.accounts.value.find(a => a.id === acc.id)?.balance).toBe(9700)
  })

  it('3. 停用規則 (isActive: false) 不會觸發自動記帳', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('停用測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const acc = await ledger.addAccount({
      name: '錢包',
      type: 'cash',
      balance: 5000,
      icon: 'Wallet',
      color: '#fff',
      currency: 'TWD'
    })

    // 先新增未來的規則，避免 addRecurring 當下立即觸發
    const futureTime = Date.now() + 86400000
    await ledger.addRecurring({
      title: '已取消的健身房',
      type: 'expense',
      amount: 1000,
      category: '娛樂休閒',
      fromAccountId: acc.id,
      frequency: 'monthly',
      interval: 1,
      startDate: Date.now(),
      nextExecutionDate: futureTime
    })

    const rule = ledger.recurringTransactions.value[0]
    await ledger.toggleRecurringActive(rule.id) // 停用

    // 修改下次執行日為過期
    rule.nextExecutionDate = Date.now() - 10000

    // 執行觸發檢測
    await ledger.checkAndTriggerRecurring()

    // 不應產生任何交易，餘額亦不扣除
    expect(ledger.transactions.value.length).toBe(0)
    expect(ledger.accounts.value.find(a => a.id === acc.id)?.balance).toBe(5000)
  })
})
