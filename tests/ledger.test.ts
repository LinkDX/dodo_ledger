import { describe, it, expect, beforeEach } from 'vitest'

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

// 2. 引入我們實作的 Composable 核心 (使用相對路徑確保絕對相容性)
import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'

describe('🐱 Dodo Ledger 多人共同記帳與演算法測試', () => {
  
  beforeEach(() => {
    // 每個測試前清空 LocalStorage
    for (const key in store) {
      delete store[key]
    }
    
    // 重置 useAuth 狀態
    const auth = useAuth()
    auth.reloadProfiles()

    // 清除全域 ledger 狀態
    const ledger = useLedger()
    ledger.clearLedgerData()
  })

  it('1. 支援「多人共用同一資產帳本，且記帳留名紀錄」功能', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    
    // 建立兩個本地身分：主人 A (🐱) 與 主人 B (🐯)
    const profileA = auth.createProfile('主人A', '🐱')
    const profileB = auth.createProfile('主人B', '🐯')
    
    expect(auth.profiles.value.length).toBe(2)
    
    // 身分登入為 主人 A，並建立一個「共同家庭錢包」帳戶
    auth.switchProfile(profileA.id)
    await ledger.loadLedgerData()
    
    await ledger.addAccount({
      name: '共同家庭錢包',
      type: 'cash',
      balance: 5000,
      icon: 'Wallet',
      color: 'gold',
      currency: 'TWD'
    })
    
    expect(ledger.accounts.value.length).toBe(1)
    expect(ledger.accounts.value[0].name).toBe('共同家庭錢包')
    expect(ledger.accounts.value[0].balance).toBe(5000)

    // 切換身分至 主人 B，顯式載入資料
    auth.switchProfile(profileB.id)
    await ledger.loadLedgerData()
    
    // 驗證 B 載入的是「同一個資產帳本」 (非隔離，而是共同理財)
    expect(ledger.accounts.value.length).toBe(1)
    expect(ledger.accounts.value[0].name).toBe('共同家庭錢包')
    expect(ledger.accounts.value[0].balance).toBe(5000) // 看到相同的 5000 元

    // 讓 主人 B 記帳一筆支出：買魚罐頭 150 元
    await ledger.addTransaction({
      type: 'expense',
      amount: 150,
      category: '餐飲',
      subCategory: '聚餐',
      fromAccountId: ledger.accounts.value[0].id,
      date: Date.now(),
      note: '買貓罐頭 🐱罐',
      tags: ['貓咪']
    })

    // 驗證資產共同連動：餘額變為 5000 - 150 = 4850 元
    expect(ledger.accounts.value[0].balance).toBe(4850)

    // 切換回 主人 A 登入，重新載入
    auth.switchProfile(profileA.id)
    await ledger.loadLedgerData()

    // 驗證 A 也看到了連動後的餘額 4850 元
    expect(ledger.accounts.value[0].balance).toBe(4850)

    // 驗證記帳留名紀錄：交易明細中，買貓罐頭這筆交易應寫著「由 主人 B 記帳」！
    expect(ledger.transactions.value.length).toBe(1)
    const tx = ledger.transactions.value[0]
    expect(tx.createdBy).toBe('主人B')
    expect(tx.createdByAvatar).toBe('🐯')
  })

  it('2. 支援「轉帳手續費獨立支出化」演算法 (SPEC 3.1)', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    
    const profile = auth.createProfile('小明', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()
    
    // 建立 銀行帳戶 (存款 1000) 與 現金帳戶 (餘額 100)
    await ledger.addAccount({
      name: '台新 Richart',
      type: 'bank',
      balance: 1000,
      icon: 'Bank',
      color: 'blue',
      currency: 'TWD'
    })
    
    await ledger.addAccount({
      name: '口袋現金',
      type: 'cash',
      balance: 100,
      icon: 'Wallet',
      color: 'gold',
      currency: 'TWD'
    })

    const bankId = ledger.accounts.value[0].id
    const cashId = ledger.accounts.value[1].id
    
    // 執行轉帳：銀行轉現金 500 元，手續費 15 元
    await ledger.addTransaction({
      type: 'transfer',
      amount: 500,
      fee: 15,
      category: '轉帳',
      fromAccountId: bankId,
      toAccountId: cashId,
      date: Date.now(),
      note: '轉零用錢',
      tags: ['日常']
    })

    // 驗證餘額：
    // 銀行應扣除 500 + 15 = 515 元 ➔ 餘額應變為 1000 - 515 = 485 元
    // 現金應增加 500 元 ➔ 餘額應變為 100 + 500 = 600 元
    expect(ledger.accounts.value[0].balance).toBe(485)
    expect(ledger.accounts.value[1].balance).toBe(600)

    // 驗證交易明細：應包含一筆轉帳交易 + 一筆自動拆分的手續費支出交易
    expect(ledger.transactions.value.length).toBe(2)
    
    const transferTx = ledger.transactions.value.find(t => t.type === 'transfer')
    const feeTx = ledger.transactions.value.find(t => t.type === 'expense')
    
    expect(transferTx).toBeDefined()
    expect(transferTx?.amount).toBe(500)
    expect(transferTx?.createdBy).toBe('小明')
    
    expect(feeTx).toBeDefined()
    expect(feeTx?.amount).toBe(15)
    expect(feeTx?.createdBy).toBe('系統自動') // 轉帳手續費自動標記為系統自動
    expect(feeTx?.note).toContain('轉帳手續費')
  })

  it('3. 支援信用卡「額度當下全扣，分月攤還」與「首期補足餘數」分期演算法 (SPEC 3.2.2)', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    
    const profile = auth.createProfile('卡奴', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()
    
    // 建立一張信用卡：額度 50,000，結帳日每月 10 號
    await ledger.addAccount({
      name: '國泰 CUBE 卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: 'purple',
      currency: 'TWD',
      cardDetails: {
        creditLimit: 50000,
        billingCycleDate: 10,
        paymentDueDate: 25
      }
    })

    const cardId = ledger.accounts.value[0].id
    
    // 模擬 2026-05-15 刷了一筆 10,000 元消費，分 3 期 (過結帳日 10 號，應歸屬 6 月首期)
    const txDate = new Date('2026-05-15').getTime()
    
    await ledger.addTransaction({
      type: 'expense',
      amount: 10000,
      category: '購物',
      fromAccountId: cardId,
      date: txDate,
      note: '買螢幕',
      tags: ['分期'],
      creditCardDetails: {
        isInstallment: true,
        installmentTerm: 3,
        currentInstallment: 1,
        billPeriod: ''
      }
    })

    // 1. 驗證可用額度當下全扣
    expect(ledger.accounts.value[0].balance).toBe(-10000)
    expect(ledger.totalLiabilities.value).toBe(10000)

    // 2. 驗證分期明細交易數量
    expect(ledger.transactions.value.length).toBe(3)

    // 3. 驗證首期補足與後續期數分配
    const inst1 = ledger.transactions.value.find(t => t.creditCardDetails?.currentInstallment === 1)
    const inst2 = ledger.transactions.value.find(t => t.creditCardDetails?.currentInstallment === 2)
    const inst3 = ledger.transactions.value.find(t => t.creditCardDetails?.currentInstallment === 3)

    expect(inst1).toBeDefined()
    expect(inst1?.amount).toBe(3334)
    expect(inst2?.amount).toBe(3333)
    expect(inst3?.amount).toBe(3333)

    // 4. 驗證帳單歸屬月份推移
    expect(inst1?.creditCardDetails?.billPeriod).toBe('2026-06')
    expect(inst2?.creditCardDetails?.billPeriod).toBe('2026-07')
    expect(inst3?.creditCardDetails?.billPeriod).toBe('2026-08')
  })

  it('4. 支援信用卡「一鍵繳款還款」邏輯 (SPEC 3.2.3)', async () => {
    const auth = useAuth()
    const ledger = useLedger()
    
    const profile = auth.createProfile('阿豪', '🐱')
    auth.switchProfile(profile.id)
    await ledger.loadLedgerData()

    // 建立 銀行帳戶 (餘額 50000)
    await ledger.addAccount({
      name: 'Richart 存款',
      type: 'bank',
      balance: 50000,
      icon: 'Bank',
      color: 'blue',
      currency: 'TWD'
    })

    // 建立 信用卡 (結帳日 10 號)
    await ledger.addAccount({
      name: '中信 LINE Pay 卡',
      type: 'credit_card',
      balance: 0,
      icon: 'CreditCard',
      color: 'green',
      currency: 'TWD',
      cardDetails: {
        creditLimit: 100000,
        billingCycleDate: 10,
        paymentDueDate: 25
      }
    })

    const bankId = ledger.accounts.value[0].id
    const cardId = ledger.accounts.value[1].id

    // 模擬 5/5 (結帳日前) 消費 3,000 元 ➔ 歸屬 "2026-05" 帳單
    await ledger.addTransaction({
      type: 'expense',
      amount: 3000,
      category: '餐飲',
      fromAccountId: cardId,
      date: new Date('2026-05-05').getTime(),
      note: '聚餐',
      tags: [],
      creditCardDetails: {
        isInstallment: false,
        installmentTerm: 1,
        currentInstallment: 1,
        billPeriod: '2026-05'
      }
    })

    expect(ledger.accounts.value[1].balance).toBe(-3000)

    // 執行一鍵繳款
    await ledger.payCreditCardBill(cardId, bankId, '2026-05')

    // 驗證餘額：
    expect(ledger.accounts.value[0].balance).toBe(47000)
    expect(ledger.accounts.value[1].balance).toBe(0)

    // 驗證還款轉帳明細是否產生
    const payTx = ledger.transactions.value.find(t => t.id.startsWith('tx_pay_'))
    expect(payTx).toBeDefined()
    expect(payTx?.amount).toBe(3000)
    expect(payTx?.type).toBe('transfer')
  })
})
