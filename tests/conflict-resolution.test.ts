import { describe, it, expect, beforeEach } from 'vitest'

// 1. 手動為 Node.js 測試環境 Mock 全域 localStorage
const store: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = String(value) },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const k in store) delete store[k] },
  length: 0,
  key: (_index: number) => null
} as any

import { useAuth } from '../src/composables/useAuth'
import { useLedger } from '../src/composables/useLedger'
import { MockDatabaseService } from '../src/services/db'
import type { AtomicOp } from '../src/services/db'

describe('🔒 多人並發衝突解決機制測試', () => {

  beforeEach(() => {
    for (const key in store) { delete store[key] }
    const auth = useAuth()
    auth.reloadProfiles()
    const { clearLedgerData } = useLedger()
    clearLedgerData()
  })

  describe('1. MockDatabaseService 原子操作 API', () => {
    
    it('addDocument 不影響現有文件', async () => {
      const db = new MockDatabaseService()
      
      // 模擬帳戶資料
      await db.saveAccounts([
        { id: 'acct_1', name: '現金', type: 'cash', balance: 10000, icon: '💰', color: '#ccc', currency: 'TWD', createdAt: 1 }
      ])
      
      // 使用 addDocument 新增，不應覆蓋原有資料
      await db.addDocument('accounts', { id: 'acct_2', name: '銀行', type: 'bank', balance: 50000, icon: '🏦', color: '#aaa', currency: 'TWD', createdAt: 2 })
      
      const accounts = await db.getAccounts()
      expect(accounts.length).toBe(2)
      expect(accounts.find(a => a.id === 'acct_1')?.balance).toBe(10000)
      expect(accounts.find(a => a.id === 'acct_2')?.balance).toBe(50000)
    })

    it('updateDocument 只修改指定欄位，不覆蓋其他欄位', async () => {
      const db = new MockDatabaseService()
      
      await db.saveAccounts([
        { id: 'acct_1', name: '現金', type: 'cash', balance: 10000, icon: '💰', color: '#ccc', currency: 'TWD', createdAt: 1 }
      ])
      
      // 只更新 name，balance 不應被影響
      await db.updateDocument('accounts', 'acct_1', { name: '零錢包' })
      
      const accounts = await db.getAccounts()
      expect(accounts[0].name).toBe('零錢包')
      expect(accounts[0].balance).toBe(10000) // 未被影響
    })

    it('deleteDocument 只刪除指定文件', async () => {
      const db = new MockDatabaseService()
      
      await db.saveTransactions([
        { id: 'tx_1', type: 'expense', amount: 100, category: '飲食', date: 1, note: '', tags: [], updatedAt: 1 },
        { id: 'tx_2', type: 'expense', amount: 200, category: '交通', date: 2, note: '', tags: [], updatedAt: 2 },
        { id: 'tx_3', type: 'income', amount: 5000, category: '薪資', date: 3, note: '', tags: [], updatedAt: 3 }
      ] as any)
      
      await db.deleteDocument('transactions', 'tx_2')
      
      const txs = await db.getTransactions()
      expect(txs.length).toBe(2)
      expect(txs.map(t => t.id)).toEqual(['tx_1', 'tx_3'])
    })

    it('claimDocument 只讓第一個裝置成功寫入', async () => {
      const db = new MockDatabaseService()
      
      const autoTx = {
        id: 'tx_auto_rec1_1700000000000',
        type: 'expense' as const,
        amount: 500,
        category: '訂閱',
        date: 1700000000000,
        note: 'Netflix (自動扣款)',
        tags: ['定期定額'],
        updatedAt: Date.now()
      }
      
      // 第一個裝置搶佔成功
      const firstClaim = await db.claimDocument('transactions', autoTx)
      expect(firstClaim).toBe(true)
      
      // 第二個裝置搶佔失敗（文件已存在）
      const secondClaim = await db.claimDocument('transactions', autoTx)
      expect(secondClaim).toBe(false)
      
      // 確認只有一筆交易
      const txs = await db.getTransactions()
      expect(txs.length).toBe(1)
    })

    it('atomicBatchWrite 原子寫入交易 + 餘額增減', async () => {
      const db = new MockDatabaseService()
      
      // 初始化帳戶
      await db.saveAccounts([
        { id: 'acct_cash', name: '現金', type: 'cash', balance: 10000, icon: '💰', color: '#ccc', currency: 'TWD', createdAt: 1 }
      ])
      
      const ops: AtomicOp[] = [
        {
          type: 'addTransaction',
          transaction: {
            id: 'tx_atomic_1',
            type: 'expense',
            amount: 300,
            category: '飲食',
            fromAccountId: 'acct_cash',
            date: Date.now(),
            note: '午餐',
            tags: [],
            updatedAt: Date.now()
          }
        },
        {
          type: 'balanceDelta',
          deltas: [{ accountId: 'acct_cash', delta: -300 }]
        }
      ]
      
      await db.atomicBatchWrite(ops)
      
      const accounts = await db.getAccounts()
      const txs = await db.getTransactions()
      
      expect(accounts[0].balance).toBe(9700)
      expect(txs.length).toBe(1)
      expect(txs[0].id).toBe('tx_atomic_1')
    })

    it('appendLog 不覆蓋其他裝置的日誌', async () => {
      const db = new MockDatabaseService()
      
      // 模擬裝置 A 寫入日誌
      await db.appendLog({
        id: 'log_a', operator: 'Alice', operatorAvatar: '👩', action: 'add_expense', description: '飲食 100 元', date: 1000
      })
      
      // 模擬裝置 B 寫入日誌
      await db.appendLog({
        id: 'log_b', operator: 'Bob', operatorAvatar: '👨', action: 'add_income', description: '薪資 50000 元', date: 2000
      })
      
      const logs = await db.getLogs()
      expect(logs.length).toBe(2)
      // 最新的在前面
      expect(logs[0].id).toBe('log_b')
      expect(logs[1].id).toBe('log_a')
    })
  })

  describe('2. 並發新增交易不丟失資料', () => {
    
    it('兩人同時記帳，兩筆交易都保留且餘額正確', async () => {
      const auth = useAuth()
      const profile = auth.createProfile('Alice', '👩')
      auth.switchProfile(profile.id)
      
      const { loadLedgerData, addAccount, addTransaction, accounts, transactions } = useLedger()
      await loadLedgerData()
      
      // 建立共用帳戶
      await addAccount({ name: '共用現金', type: 'cash', balance: 10000, icon: '💰', color: '#ccc', currency: 'TWD' })
      const acctId = accounts.value[0].id
      
      // Alice 記帳 500 元
      await addTransaction({
        type: 'expense', amount: 500, category: '飲食', fromAccountId: acctId,
        date: Date.now(), note: 'Alice 午餐', tags: []
      })
      
      // Bob 記帳 300 元（模擬幾乎同時）
      await addTransaction({
        type: 'expense', amount: 300, category: '交通', fromAccountId: acctId,
        date: Date.now(), note: 'Bob 搭車', tags: []
      })
      
      // 驗證：兩筆交易都存在
      expect(transactions.value.length).toBe(2)
      // 驗證：餘額正確 (10000 - 500 - 300 = 9200)
      expect(accounts.value[0].balance).toBe(9200)
    })

    it('轉帳 + 手續費交易原子寫入，餘額完全一致', async () => {
      const auth = useAuth()
      const profile = auth.createProfile('Alice', '👩')
      auth.switchProfile(profile.id)
      
      const { loadLedgerData, addAccount, addTransaction, accounts, transactions } = useLedger()
      await loadLedgerData()
      
      await addAccount({ name: '銀行A', type: 'bank', balance: 10000, icon: '🏦', color: '#aaa', currency: 'TWD' })
      await addAccount({ name: '銀行B', type: 'bank', balance: 5000, icon: '🏦', color: '#bbb', currency: 'TWD' })
      
      const fromId = accounts.value[0].id
      const toId = accounts.value[1].id
      
      // 轉帳 2000 元，手續費 15 元
      await addTransaction({
        type: 'transfer', amount: 2000, fee: 15, category: '轉帳',
        fromAccountId: fromId, toAccountId: toId,
        date: Date.now(), note: '轉帳測試', tags: []
      })
      
      // 驗證餘額
      const bankA = accounts.value.find(a => a.id === fromId)!
      const bankB = accounts.value.find(a => a.id === toId)!
      expect(bankA.balance).toBe(10000 - 2000 - 15) // 7985
      expect(bankB.balance).toBe(5000 + 2000) // 7000
      
      // 驗證交易數（主交易 + 手續費交易 = 2）
      expect(transactions.value.length).toBe(2)
    })
  })

  describe('3. 刪除交易原子回退餘額', () => {
    
    it('刪除支出交易後餘額正確回退', async () => {
      const auth = useAuth()
      const profile = auth.createProfile('Alice', '👩')
      auth.switchProfile(profile.id)
      
      const { loadLedgerData, addAccount, addTransaction, deleteTransaction, accounts, transactions } = useLedger()
      await loadLedgerData()
      
      await addAccount({ name: '現金', type: 'cash', balance: 5000, icon: '💰', color: '#ccc', currency: 'TWD' })
      const acctId = accounts.value[0].id
      
      await addTransaction({
        type: 'expense', amount: 1000, category: '飲食', fromAccountId: acctId,
        date: Date.now(), note: '大餐', tags: []
      })
      
      expect(accounts.value[0].balance).toBe(4000)
      
      const txId = transactions.value[0].id
      await deleteTransaction(txId)
      
      expect(accounts.value[0].balance).toBe(5000) // 回退
      expect(transactions.value.length).toBe(0)
    })

    it('刪除收入交易後餘額正確回退', async () => {
      const auth = useAuth()
      const profile = auth.createProfile('Alice', '👩')
      auth.switchProfile(profile.id)
      
      const { loadLedgerData, addAccount, addTransaction, deleteTransaction, accounts, transactions } = useLedger()
      await loadLedgerData()
      
      await addAccount({ name: '銀行', type: 'bank', balance: 20000, icon: '🏦', color: '#aaa', currency: 'TWD' })
      const acctId = accounts.value[0].id
      
      await addTransaction({
        type: 'income', amount: 50000, category: '薪資', toAccountId: acctId,
        date: Date.now(), note: '月薪', tags: []
      })
      
      expect(accounts.value[0].balance).toBe(70000)
      
      const txId = transactions.value[0].id
      await deleteTransaction(txId)
      
      expect(accounts.value[0].balance).toBe(20000) // 回退
    })
  })

  describe('4. 編輯交易原子差值更新', () => {
    
    it('修改金額時以 delta 方式正確更新餘額', async () => {
      const auth = useAuth()
      const profile = auth.createProfile('Alice', '👩')
      auth.switchProfile(profile.id)
      
      const { loadLedgerData, addAccount, addTransaction, editTransaction, accounts, transactions } = useLedger()
      await loadLedgerData()
      
      await addAccount({ name: '現金', type: 'cash', balance: 10000, icon: '💰', color: '#ccc', currency: 'TWD' })
      const acctId = accounts.value[0].id
      
      await addTransaction({
        type: 'expense', amount: 500, category: '飲食', fromAccountId: acctId,
        date: Date.now(), note: '午餐', tags: []
      })
      
      expect(accounts.value[0].balance).toBe(9500)
      
      const txId = transactions.value[0].id
      
      // 修改金額 500 → 800（差值 -300）
      await editTransaction(txId, { amount: 800 })
      
      expect(accounts.value[0].balance).toBe(9200) // 10000 - 800
      expect(transactions.value[0].amount).toBe(800)
    })

    it('修改帳戶時正確回退舊帳戶並扣減新帳戶', async () => {
      const auth = useAuth()
      const profile = auth.createProfile('Alice', '👩')
      auth.switchProfile(profile.id)
      
      const { loadLedgerData, addAccount, addTransaction, editTransaction, accounts, transactions } = useLedger()
      await loadLedgerData()
      
      await addAccount({ name: '現金', type: 'cash', balance: 5000, icon: '💰', color: '#ccc', currency: 'TWD' })
      await addAccount({ name: '銀行', type: 'bank', balance: 20000, icon: '🏦', color: '#aaa', currency: 'TWD' })
      
      const cashId = accounts.value[0].id
      const bankId = accounts.value[1].id
      
      await addTransaction({
        type: 'expense', amount: 1000, category: '飲食', fromAccountId: cashId,
        date: Date.now(), note: '晚餐', tags: []
      })
      
      expect(accounts.value[0].balance).toBe(4000) // 現金扣了 1000
      expect(accounts.value[1].balance).toBe(20000) // 銀行未動
      
      const txId = transactions.value[0].id
      
      // 改為從銀行扣款
      await editTransaction(txId, { fromAccountId: bankId })
      
      expect(accounts.value[0].balance).toBe(5000) // 現金回退
      expect(accounts.value[1].balance).toBe(19000) // 銀行扣了 1000
    })
  })

  describe('5. 週期記帳防重複執行 (claimDocument)', () => {
    
    it('claimDocument 保證同一筆週期交易只被執行一次', async () => {
      const db = new MockDatabaseService()
      
      // 模擬兩台裝置同時嘗試寫入相同的週期交易
      const autoTxId = 'tx_auto_rec_netflix_1700000000000'
      const autoTx = {
        id: autoTxId,
        type: 'expense' as const,
        amount: 390,
        category: '訂閱',
        fromAccountId: 'acct_1',
        date: 1700000000000,
        note: 'Netflix (自動扣款)',
        tags: ['定期定額'],
        updatedAt: Date.now()
      }
      
      // 模擬並發：兩台裝置幾乎同時 claimDocument
      const [result1, result2] = await Promise.all([
        db.claimDocument('transactions', autoTx),
        db.claimDocument('transactions', { ...autoTx }) // 相同 ID
      ])
      
      // 至少一個成功，至少一個失敗（或一個成功一個失敗）
      // 在本地模式（同步），第一個一定成功，第二個一定失敗
      expect(result1).toBe(true)
      expect(result2).toBe(false)
      
      // 確認只寫入一筆
      const txs = await db.getTransactions()
      expect(txs.length).toBe(1)
    })
  })

  describe('6. subscribeCollection 即時同步介面', () => {
    
    it('MockDatabaseService 的 subscribeCollection 回傳取消函數', () => {
      const db = new MockDatabaseService()
      const unsub = db.subscribeCollection('accounts', () => {})
      expect(typeof unsub).toBe('function')
      unsub() // 不應拋錯
    })
  })

  describe('7. 原子批次操作多筆 delta 合併', () => {
    
    it('多筆 delta 正確累加到同一帳戶', async () => {
      const db = new MockDatabaseService()
      
      await db.saveAccounts([
        { id: 'acct_1', name: '銀行', type: 'bank', balance: 10000, icon: '🏦', color: '#aaa', currency: 'TWD', createdAt: 1 }
      ])
      
      // 模擬：一次批次操作中多筆 delta 影響同一帳戶
      const ops: AtomicOp[] = [
        { type: 'balanceDelta', deltas: [{ accountId: 'acct_1', delta: -500 }] },
        { type: 'balanceDelta', deltas: [{ accountId: 'acct_1', delta: -300 }] },
        { type: 'balanceDelta', deltas: [{ accountId: 'acct_1', delta: 1000 }] }
      ]
      
      await db.atomicBatchWrite(ops)
      
      const accounts = await db.getAccounts()
      // 10000 - 500 - 300 + 1000 = 10200
      expect(accounts[0].balance).toBe(10200)
    })

    it('deleteTransaction + balanceDelta 原子回退', async () => {
      const db = new MockDatabaseService()
      
      await db.saveAccounts([
        { id: 'acct_1', name: '現金', type: 'cash', balance: 8000, icon: '💰', color: '#ccc', currency: 'TWD', createdAt: 1 }
      ])
      await db.saveTransactions([
        { id: 'tx_del_1', type: 'expense', amount: 2000, category: '飲食', fromAccountId: 'acct_1', date: 1, note: '', tags: [], updatedAt: 1 }
      ] as any)
      
      const ops: AtomicOp[] = [
        { type: 'deleteTransaction', transactionId: 'tx_del_1' },
        { type: 'balanceDelta', deltas: [{ accountId: 'acct_1', delta: 2000 }] }
      ]
      
      await db.atomicBatchWrite(ops)
      
      const accounts = await db.getAccounts()
      const txs = await db.getTransactions()
      expect(accounts[0].balance).toBe(10000) // 8000 + 2000 回退
      expect(txs.length).toBe(0)
    })
  })
})
