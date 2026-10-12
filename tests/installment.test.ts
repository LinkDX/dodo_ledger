import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock LocalStorage
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

describe('💳 信用卡分期付款核心演算法測試 (SPEC 3.2.1)', () => {
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

  it('1. 分期付款「額度當下全額扣除、首期補足餘數」演算法正確性 (10,000 分 3 期)', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('分期測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 建立一張玉山信用卡，額度 50,000，結帳日 10 號
    const card = await ledger.addAccount({
      name: '玉山信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#6C5CE7',
      currency: 'TWD',
      cardDetails: {
        creditLimit: 50000,
        billingCycleDate: 10,
        paymentDueDate: 25
      }
    })

    // 模擬 2026-05-01 購買 10,000 元 3C 產品，分 3 期
    const txDate = new Date('2026-05-01T12:00:00Z').getTime()
    await ledger.addTransaction({
      type: 'expense',
      amount: 10000,
      category: '購物',
      subCategory: '電子 3C',
      fromAccountId: card.id,
      date: txDate,
      note: '購買新耳機',
      tags: [],
      creditCardDetails: {
        isInstallment: true,
        installmentTerm: 3,
        currentInstallment: 1,
        billPeriod: ''
      }
    })

    // 驗證 A：信用卡餘額當下全額扣除 10,000 (呈現負值 -10000)
    const cardInLedger = ledger.accounts.value.find(a => a.id === card.id)
    expect(cardInLedger?.balance).toBe(-10000)

    // 驗證 B：交易明細應自動展開為 3 筆獨立分期交易
    const installmentTxs = ledger.transactions.value.filter(tx => tx.creditCardDetails?.isInstallment)
    expect(installmentTxs.length).toBe(3)

    // 依期數排序
    installmentTxs.sort((a, b) => (a.creditCardDetails?.currentInstallment || 0) - (b.creditCardDetails?.currentInstallment || 0))

    // 驗證 C：首期補足餘數
    // baseShare = Math.floor(10000 / 3) = 3333
    // firstShare = 10000 - (3333 * 2) = 3334
    expect(installmentTxs[0].amount).toBe(3334)
    expect(installmentTxs[0].creditCardDetails?.currentInstallment).toBe(1)
    expect(installmentTxs[1].amount).toBe(3333)
    expect(installmentTxs[1].creditCardDetails?.currentInstallment).toBe(2)
    expect(installmentTxs[2].amount).toBe(3333)
    expect(installmentTxs[2].creditCardDetails?.currentInstallment).toBe(3)

    // 總和嚴格等於 10,000
    const sum = installmentTxs.reduce((s, tx) => s + tx.amount, 0)
    expect(sum).toBe(10000)
  })

  it('2. 帳單週期推算：結帳日前 vs 結帳日後消費所屬帳期計算', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('帳期測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 信用卡每月 10 號結帳
    const card = await ledger.addAccount({
      name: '台新信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#FF6B6B',
      currency: 'TWD',
      cardDetails: { creditLimit: 30000, billingCycleDate: 10, paymentDueDate: 25 }
    })

    // 情況 A：5 月 5 號消費 (5 <= 10) ➔ 帳單應歸屬 2026-05
    const dateBefore = new Date('2026-05-05T12:00:00Z').getTime()
    const periodBefore = ledger.getBillPeriodForCard(card.id, dateBefore)
    expect(periodBefore).toBe('2026-05')

    // 情況 B：5 月 15 號消費 (15 > 10) ➔ 帳單應歸屬 2026-06
    const dateAfter = new Date('2026-05-15T12:00:00Z').getTime()
    const periodAfter = ledger.getBillPeriodForCard(card.id, dateAfter)
    expect(periodAfter).toBe('2026-06')

    // 情況 C：12 月 20 號消費 (跨年) ➔ 帳單應歸屬 2027-01
    const dateEndOfYear = new Date('2026-12-20T12:00:00Z').getTime()
    const periodEndOfYear = ledger.getBillPeriodForCard(card.id, dateEndOfYear)
    expect(periodEndOfYear).toBe('2027-01')
  })

  it('3. 分期付款各期數帳單月份按月順延推算', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('順延測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 結帳日 10 號
    const card = await ledger.addAccount({
      name: '聯邦信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#4ECDC4',
      currency: 'TWD',
      cardDetails: { creditLimit: 40000, billingCycleDate: 10, paymentDueDate: 25 }
    })

    // 2026-11-15 消費 6000 分 3 期 (消費日 15 > 結帳日 10，首期應為 2026-12)
    const txDate = new Date('2026-11-15T12:00:00Z').getTime()
    await ledger.addTransaction({
      type: 'expense',
      amount: 6000,
      category: '娛樂休閒',
      fromAccountId: card.id,
      date: txDate,
      note: '購買遊戲機',
      tags: [],
      creditCardDetails: {
        isInstallment: true,
        installmentTerm: 3,
        currentInstallment: 1,
        billPeriod: ''
      }
    })

    const txs = ledger.transactions.value.filter(tx => tx.creditCardDetails?.isInstallment)
    txs.sort((a, b) => (a.creditCardDetails?.currentInstallment || 0) - (b.creditCardDetails?.currentInstallment || 0))

    // 第 1 期：2026-12
    expect(txs[0].creditCardDetails?.billPeriod).toBe('2026-12')
    // 第 2 期：2027-01 (跨年自動進位)
    expect(txs[1].creditCardDetails?.billPeriod).toBe('2027-01')
    // 第 3 期：2027-02
    expect(txs[2].creditCardDetails?.billPeriod).toBe('2027-02')
  })

  it('4. 結帳日 27 號之跨月出帳週期推算：8/28~9/27 歸屬 10 月帳單，9/28~10/27 歸屬 11 月帳單', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('結帳日27測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 結帳日 27 號，繳款日 12 號 (paymentDueDate < billingCycleDate 跨月出帳)
    const card = await ledger.addAccount({
      name: '中信信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#00B894',
      currency: 'TWD',
      cardDetails: { creditLimit: 50000, billingCycleDate: 27, paymentDueDate: 12 }
    })

    // 8 月 28 號消費 -> 9/27 結帳 -> 歸屬 2026-10 帳單
    const d1 = new Date('2026-08-28T12:00:00Z').getTime()
    expect(ledger.getBillPeriodForCard(card.id, d1)).toBe('2026-10')

    // 9 月 15 號消費 -> 9/27 結帳 -> 歸屬 2026-10 帳單
    const d2 = new Date('2026-09-15T12:00:00Z').getTime()
    expect(ledger.getBillPeriodForCard(card.id, d2)).toBe('2026-10')

    // 9 月 27 號消費 (結帳日當天) -> 9/27 結帳 -> 歸屬 2026-10 帳單
    const d3 = new Date('2026-09-27T12:00:00Z').getTime()
    expect(ledger.getBillPeriodForCard(card.id, d3)).toBe('2026-10')

    // 9 月 28 號消費 (已過結帳日) -> 10/27 結帳 -> 歸屬 2026-11 帳單
    const d4 = new Date('2026-09-28T12:00:00Z').getTime()
    expect(ledger.getBillPeriodForCard(card.id, d4)).toBe('2026-11')

    // 10 月 27 號消費 -> 10/27 結帳 -> 歸屬 2026-11 帳單
    const d5 = new Date('2026-10-27T12:00:00Z').getTime()
    expect(ledger.getBillPeriodForCard(card.id, d5)).toBe('2026-11')
  })

  it('5. 支援自訂帳單金額與無明細歷史月份手動銷帳', async () => {
    const auth = useAuth()
    const ledger = useLedger()

    const user = await auth.createProfile('銷帳測試者', '🐱')
    auth.switchProfile(user.id)
    await ledger.loadLedgerData()

    // 建立銀行帳戶與信用卡
    const bank = await ledger.addAccount({
      name: '薪轉銀行',
      type: 'bank',
      balance: 100000,
      icon: 'Landmark',
      color: '#0984E3',
      currency: 'TWD'
    })

    const card = await ledger.addAccount({
      name: '富邦信用卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: '#6C5CE7',
      currency: 'TWD',
      cardDetails: { creditLimit: 50000, billingCycleDate: 27, paymentDueDate: 12 }
    })

    // 使用者 10 月才開始記帳，9 月帳單 (2026-09) 無任何消費明細
    // 1) 測試手動自訂 9 月帳單應繳金額為 15,000 元
    await ledger.setCustomBillAmount(card.id, '2026-09', 15000)
    const cardUpdated = ledger.accounts.value.find(a => a.id === card.id)
    expect(cardUpdated?.cardDetails?.customBillAmounts?.['2026-09']).toBe(15000)

    // 2) 執行銷帳扣款：從銀行帳戶扣除 15,000 元
    await ledger.payCreditCardBill(card.id, bank.id, '2026-09', 15000)

    // 驗證銀行扣款 15,000 (100,000 -> 85,000)
    const bankAfter = ledger.accounts.value.find(a => a.id === bank.id)
    expect(bankAfter?.balance).toBe(85000)

    // 驗證信用卡可用額度增加 15,000 (0 -> 15,000)
    const cardAfter = ledger.accounts.value.find(a => a.id === card.id)
    expect(cardAfter?.balance).toBe(15000)

    // 驗證產生轉帳還款記錄且帶有 billPeriod
    const payTx = ledger.transactions.value.find(tx => tx.note?.includes('2026-09 帳單'))
    expect(payTx).toBeDefined()
    expect(payTx?.amount).toBe(15000)
    expect(payTx?.creditCardDetails?.billPeriod).toBe('2026-09')

    // 驗證銷帳扣款後，信用卡自動記憶綁定此扣款銀行帳戶
    expect(cardAfter?.cardDetails?.linkedBankAccountId).toBe(bank.id)
  })
})
