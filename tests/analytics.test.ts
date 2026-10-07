import { describe, it, expect, beforeEach } from 'vitest'
import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'
import { getDatabaseService } from '../src/services/db'

describe('📊 財務統計分析與報表彙總演算法測試 (SPEC 3.5)', () => {
  beforeEach(async () => {
    const db = getDatabaseService() as any
    if (db.clearAllData) db.clearAllData()
    const auth = useAuth()
    await auth.reloadProfiles()
    const ledger = useLedger()
    ledger.clearLedgerData()
  })

  it('1. 基礎收支與淨資產結餘計算：正負資產與多帳戶合併統計', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('財務分析師', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 建立 1 個銀行帳戶 (資產 50,000) 與 1 個信用卡 (額度 100,000，負債 0)
    const bank = await ledger.addAccount({
      name: '玉山銀行',
      type: 'bank',
      balance: 50000,
      icon: 'Landmark',
      color: '#fff',
      currency: 'TWD'
    })

    const card = await ledger.addAccount({
      name: '黑狗卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#fff',
      currency: 'TWD',
      cardDetails: {
        billingCycleDate: 15,
        paymentDueDate: 5,
        creditLimit: 100000
      }
    })

    expect(ledger.totalAssets.value).toBe(50000)
    expect(ledger.totalLiabilities.value).toBe(0)
    expect(ledger.netWorth.value).toBe(50000)

    // 記一筆現金支出 15,000 元
    await ledger.addTransaction({
      type: 'expense',
      amount: 15000,
      category: '居家生活',
      fromAccountId: bank.id,
      date: Date.now(),
      note: '買吸塵器',
      tags: []
    })

    // 記一筆信用卡支出 5,000 元
    await ledger.addTransaction({
      type: 'expense',
      amount: 5000,
      category: '餐飲',
      fromAccountId: card.id,
      date: Date.now(),
      note: '家族聚餐',
      tags: []
    })

    // 記一筆薪資收入 60,000 元
    await ledger.addTransaction({
      type: 'income',
      amount: 60000,
      category: '薪資',
      toAccountId: bank.id,
      date: Date.now(),
      note: '本月薪資',
      tags: []
    })

    // 銀行餘額 = 50,000 - 15,000 + 60,000 = 95,000
    // 信用卡餘額 = -5,000 (負債 5,000)
    expect(ledger.totalAssets.value).toBe(95000)
    expect(ledger.totalLiabilities.value).toBe(5000)
    expect(ledger.netWorth.value).toBe(90000)

    // 當月總收入 = 60,000，總支出 = 15,000 + 5,000 = 20,000
    expect(ledger.monthlyIncome.value).toBe(60000)
    expect(ledger.monthlyExpense.value).toBe(20000)
  })

  it('2. 信用卡分期交易跨月費用認列：只在分期該月計入當月支出', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('分期分析師', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const card = await ledger.addAccount({
      name: '分期專用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#fff',
      currency: 'TWD',
      cardDetails: {
        billingCycleDate: 28, // 確保目前日期落在當期
        paymentDueDate: 15,
        creditLimit: 50000
      }
    })

    // 刷一筆 30,000 元分 3 期 (每期 10,000 元)
    await ledger.addTransaction({
      type: 'expense',
      amount: 30000,
      category: '3C數位',
      fromAccountId: card.id,
      date: Date.now(),
      note: '筆電分期',
      tags: ['分期'],
      creditCardDetails: {
        isInstallment: true,
        installmentTerm: 3,
        currentInstallment: 1,
        billPeriod: currentPeriod
      }
    })

    // 信用卡額度當下全額佔用扣減 (餘額 -30,000)
    const cardAfter = ledger.accounts.value.find(a => a.id === card.id)
    expect(cardAfter?.balance).toBe(-30000)

    // 但是當月總支出 (monthlyExpense) 只認列首期 10,000 元！
    // 不會重複扣除整筆 30,000 元
    expect(ledger.monthlyExpense.value).toBe(10000)
  })

  it('3. 轉帳手續費獨立支出化統計：轉帳本金不計入支出，手續費獨立計入支出', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('轉帳分析師', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    const accA = await ledger.addAccount({
      name: '活期帳戶A',
      type: 'bank',
      balance: 10000,
      icon: 'Landmark',
      color: '#fff',
      currency: 'TWD'
    })

    const accB = await ledger.addAccount({
      name: '活期帳戶B',
      type: 'bank',
      balance: 0,
      icon: 'Landmark',
      color: '#fff',
      currency: 'TWD'
    })

    // 從 A 轉帳 5,000 元至 B，手續費 15 元
    await ledger.addTransaction({
      type: 'transfer',
      amount: 5000,
      category: '轉帳',
      fee: 15,
      fromAccountId: accA.id,
      toAccountId: accB.id,
      date: Date.now(),
      note: '轉帳生活費',
      tags: []
    })

    // A 餘額 = 10,000 - 5,000 - 15 = 4,985
    // B 餘額 = 5,000
    const a = ledger.accounts.value.find(ac => ac.id === accA.id)
    const b = ledger.accounts.value.find(ac => ac.id === accB.id)
    expect(a?.balance).toBe(4985)
    expect(b?.balance).toBe(5000)

    // 淨資產 = 9,985 (只減少了手續費 15 元，5,000 轉帳在內部流轉)
    expect(ledger.netWorth.value).toBe(9985)

    // 當月支出僅為手續費 15 元，轉帳本金 5,000 元不計入支出
    expect(ledger.monthlyExpense.value).toBe(15)
  })
})
