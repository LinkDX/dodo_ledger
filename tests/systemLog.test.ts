import { describe, it, expect, beforeEach } from 'vitest'
import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'
import { getDatabaseService, addSystemLog } from '../src/services/db'

describe('📜 系統財務與成員變更稽核日誌測試 (GEMINI 3.4)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
    const ledger = useLedger()
    ledger.clearLedgerData()
  })

  it('1. 核心財務操作 (記帳、刪除、還款) 自動觸發 Append-only 系統日誌', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const db = getDatabaseService()

    const user = await auth.createProfile('日誌稽核員', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const cash = await ledger.addAccount({
      name: '現金皮夾',
      type: 'cash',
      balance: 10000,
      icon: 'Wallet',
      color: '#fff',
      currency: 'TWD'
    })

    // 記一筆支出
    await ledger.addTransaction({
      type: 'expense',
      amount: 500,
      category: '餐飲',
      fromAccountId: cash.id,
      date: Date.now(),
      note: '美味下午茶',
      tags: []
    })

    // 等待日誌寫入
    await new Promise(r => setTimeout(r, 50))

    const logs = await db.getLogs()
    expect(logs.length).toBeGreaterThan(0)

    // 最新的日誌應為剛剛記的支出
    const latestExpenseLog = logs.find(l => l.action === 'add_expense')
    expect(latestExpenseLog).toBeDefined()
    expect(latestExpenseLog?.description).toContain('500 元')
    expect(latestExpenseLog?.description).toContain('餐飲')
  })

  it('2. 信用卡一鍵還款操作記錄完整沖銷細節', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const db = getDatabaseService()

    const user = await auth.createProfile('還款稽核員', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const bank = await ledger.addAccount({
      name: '薪轉帳戶',
      type: 'bank',
      balance: 50000,
      icon: 'Landmark',
      color: '#fff',
      currency: 'TWD'
    })

    const card = await ledger.addAccount({
      name: '信用卡A',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#fff',
      currency: 'TWD',
      cardDetails: {
        billingCycleDate: 10,
        paymentDueDate: 25,
        creditLimit: 50000
      }
    })

    const now = new Date()
    const billPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // 刷一筆 3,000 元消費生成當期帳單
    await ledger.addTransaction({
      type: 'expense',
      amount: 3000,
      category: '購物',
      fromAccountId: card.id,
      date: Date.now(),
      note: '刷卡買日常用品',
      tags: []
    })

    // 執行一鍵還款
    await ledger.payCreditCardBill(card.id, bank.id, billPeriod)

    await new Promise(r => setTimeout(r, 80))
    const logs = await db.getLogs()

    const payLog = logs.find(l => l.action === 'pay_credit_card')
    expect(payLog).toBeDefined()
    expect(payLog?.description).toContain('信用卡A')
    expect(payLog?.description).toContain('3000 元')
  })

  it('3. 吉祥物娛樂操作 (摸貓/玩逗貓棒) 禁止寫入系統財務日誌 (SPEC 規範)', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    const db = getDatabaseService()

    const user = await auth.createProfile('貓奴玩家', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 取得當前日誌筆數
    const initialLogs = await db.getLogs()
    const initialCount = initialLogs.length

    // 進行純娛樂互動：撫摸、逗貓棒
    await ledger.interactWithCat('pet')
    await ledger.interactWithCat('play_teaser')

    await new Promise(r => setTimeout(r, 50))
    const afterLogs = await db.getLogs()

    // 日誌數量不應增加！娛樂操作不得污染財務日誌
    expect(afterLogs.length).toBe(initialCount)
  })
})
