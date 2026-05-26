import type { Account, Transaction, RecurringTransaction } from '../types'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import { FIREBASE_CONFIG } from '../config/firebase'

// 1. 抽象資料庫服務介面 (多人共同記帳模型，維護同一個資產紀錄)
export interface DatabaseService {
  getAccounts(): Promise<Account[]>;
  saveAccounts(accounts: Account[]): Promise<void>;
  
  getTransactions(): Promise<Transaction[]>;
  saveTransactions(transactions: Transaction[]): Promise<void>;
  
  getRecurring(): Promise<RecurringTransaction[]>;
  saveRecurring(recurring: RecurringTransaction[]): Promise<void>;
}

// 2. 本地體驗模式 (LocalStorage 實作，全域共享同一個資產與交易池)
export class MockDatabaseService implements DatabaseService {
  private ACCOUNTS_KEY = 'dodo_ledger_shared_accounts'
  private TRANSACTIONS_KEY = 'dodo_ledger_shared_transactions'
  private RECURRING_KEY = 'dodo_ledger_shared_recurring'

  async getAccounts(): Promise<Account[]> {
    if (typeof localStorage === 'undefined') return []
    const data = localStorage.getItem(this.ACCOUNTS_KEY)
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch (e) {
      return []
    }
  }

  async saveAccounts(accounts: Account[]): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts))
  }

  async getTransactions(): Promise<Transaction[]> {
    if (typeof localStorage === 'undefined') return []
    const data = localStorage.getItem(this.TRANSACTIONS_KEY)
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch (e) {
      return []
    }
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(transactions))
  }

  async getRecurring(): Promise<RecurringTransaction[]> {
    if (typeof localStorage === 'undefined') return []
    const data = localStorage.getItem(this.RECURRING_KEY)
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch (e) {
      return []
    }
  }

  async saveRecurring(recurring: RecurringTransaction[]): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.RECURRING_KEY, JSON.stringify(recurring))
  }
}

// 3. 雲端 Firebase 同步模式實作 (多人共同記帳 Firestore 實作)
// 為了提供多人共同記帳的即時備份與無縫連動，我們讀寫 Firestore 中 "ledgers/dodo_shared_ledger" 全域文檔
export class FirestoreDatabaseService implements DatabaseService {
  private db: any
  private docRef: any

  constructor(firebaseConfig: any) {
    const app = initializeApp(firebaseConfig)
    this.db = getFirestore(app)
    this.docRef = doc(this.db, 'ledgers', 'dodo_shared_ledger')
    console.log('[Dodo Ledger] 🐱 成功建立且自動初始化 Firestore 雲端連線服務層！');
  }

  async getAccounts(): Promise<Account[]> {
    try {
      const snap = await getDoc(this.docRef)
      if (snap.exists()) {
        const data = snap.data() as any
        return data.accounts || []
      }
      return []
    } catch (e) {
      console.error('[Dodo Ledger] 獲取雲端帳戶失敗：', e)
      return []
    }
  }

  async saveAccounts(accounts: Account[]): Promise<void> {
    try {
      await setDoc(this.docRef, { accounts }, { merge: true })
    } catch (e) {
      console.error('[Dodo Ledger] 儲存雲端帳戶失敗：', e)
    }
  }

  async getTransactions(): Promise<Transaction[]> {
    try {
      const snap = await getDoc(this.docRef)
      if (snap.exists()) {
        const data = snap.data() as any
        return data.transactions || []
      }
      return []
    } catch (e) {
      console.error('[Dodo Ledger] 獲取雲端交易紀錄失敗：', e)
      return []
    }
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    try {
      await setDoc(this.docRef, { transactions }, { merge: true })
    } catch (e) {
      console.error('[Dodo Ledger] 儲存雲端交易紀錄失敗：', e)
    }
  }

  async getRecurring(): Promise<RecurringTransaction[]> {
    try {
      const snap = await getDoc(this.docRef)
      if (snap.exists()) {
        const data = snap.data() as any
        return data.recurring || []
      }
      return []
    } catch (e) {
      console.error('[Dodo Ledger] 獲取雲端自動記帳設定失敗：', e)
      return []
    }
  }

  async saveRecurring(recurring: RecurringTransaction[]): Promise<void> {
    try {
      await setDoc(this.docRef, { recurring }, { merge: true })
    } catch (e) {
      console.error('[Dodo Ledger] 儲存雲端自動記帳設定失敗：', e)
    }
  }
}

// 4. 自動連線與資料庫選擇核心
let activeService: DatabaseService = new MockDatabaseService();

const isTestMode = typeof globalThis !== 'undefined' && (
  (globalThis as any).process?.env?.NODE_ENV === 'test' || 
  (globalThis as any).process?.env?.VITEST === 'true'
)

const isRealFirebase = 
  !isTestMode &&
  FIREBASE_CONFIG.apiKey && 
  FIREBASE_CONFIG.apiKey !== 'AIzaSyFakeKeyForDodoLedgerProjectInner2026' &&
  !FIREBASE_CONFIG.apiKey.includes('FakeKey')

if (isRealFirebase) {
  try {
    activeService = new FirestoreDatabaseService(FIREBASE_CONFIG)
    console.log('[Dodo Ledger] ☁️ 檢測到真實 Firebase 設定，已自動切換為雲端資料庫模式！');
  } catch (e) {
    console.error('[Dodo Ledger] 自動初始化 Firebase 失敗，切回本地體驗模式：', e);
    activeService = new MockDatabaseService();
  }
} else {
  console.log('[Dodo Ledger] 📟 使用本地 LocalStorage 離線儲存模式。');
}

export function getDatabaseService(): DatabaseService {
  return activeService;
}

export function switchDatabaseService(service: DatabaseService) {
  activeService = service;
}
