import type { Account, Transaction, RecurringTransaction, UserProfile, SystemLog } from '../types'
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

  getProfiles(): Promise<UserProfile[]>;
  saveProfiles(profiles: UserProfile[]): Promise<void>;

  getLogs(): Promise<SystemLog[]>;
  saveLogs(logs: SystemLog[]): Promise<void>;
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

  private PROFILES_KEY = 'dodo_ledger_shared_profiles'
  private LOGS_KEY = 'dodo_ledger_shared_logs'

  async getProfiles(): Promise<UserProfile[]> {
    if (typeof localStorage === 'undefined') return []
    const data = localStorage.getItem(this.PROFILES_KEY)
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch (e) {
      return []
    }
  }

  async saveProfiles(profiles: UserProfile[]): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles))
  }

  async getLogs(): Promise<SystemLog[]> {
    if (typeof localStorage === 'undefined') return []
    const data = localStorage.getItem(this.LOGS_KEY)
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch (e) {
      return []
    }
  }

  async saveLogs(logs: SystemLog[]): Promise<void> {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(this.LOGS_KEY, JSON.stringify(logs))
  }
}

// 工具函式：遞迴移除所有 undefined 欄位，避免 Firestore 拒絕寫入
function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as object)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    ) as T
  }
  return obj
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
      await setDoc(this.docRef, { accounts: stripUndefined(accounts) }, { merge: true })
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
      await setDoc(this.docRef, { transactions: stripUndefined(transactions) }, { merge: true })
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
      await setDoc(this.docRef, { recurring: stripUndefined(recurring) }, { merge: true })
    } catch (e) {
      console.error('[Dodo Ledger] 儲存雲端自動記帳設定失敗：', e)
    }
  }

  async getProfiles(): Promise<UserProfile[]> {
    try {
      const snap = await getDoc(this.docRef)
      if (snap.exists()) {
        const data = snap.data() as any
        return data.profiles || []
      }
      return []
    } catch (e) {
      console.error('[Dodo Ledger] 獲取雲端身分列表失敗：', e)
      return []
    }
  }

  async saveProfiles(profiles: UserProfile[]): Promise<void> {
    try {
      await setDoc(this.docRef, { profiles: stripUndefined(profiles) }, { merge: true })
    } catch (e) {
      console.error('[Dodo Ledger] 儲存雲端身分列表失敗：', e)
    }
  }

  async getLogs(): Promise<SystemLog[]> {
    try {
      const snap = await getDoc(this.docRef)
      if (snap.exists()) {
        const data = snap.data() as any
        return data.logs || []
      }
      return []
    } catch (e) {
      console.error('[Dodo Ledger] 獲取雲端操作日誌失敗：', e)
      return []
    }
  }

  async saveLogs(logs: SystemLog[]): Promise<void> {
    try {
      await setDoc(this.docRef, { logs: stripUndefined(logs) }, { merge: true })
    } catch (e) {
      console.error('[Dodo Ledger] 儲存雲端操作日誌失敗：', e)
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

export async function addSystemLog(
  operator: string,
  operatorAvatar: string,
  action: string,
  description: string
): Promise<void> {
  try {
    const dbService = getDatabaseService();
    const logs = await dbService.getLogs();
    
    // 生成唯一 ID
    const logId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const newLog: SystemLog = {
      id: logId,
      operator,
      operatorAvatar,
      action,
      description,
      date: Date.now()
    };
    
    // 僅保留最新 200 筆以避免過載
    const updatedLogs = [newLog, ...logs].slice(0, 200);
    await dbService.saveLogs(updatedLogs);
  } catch (e) {
    console.error('[Dodo Ledger] 寫入系統日誌失敗：', e);
  }
}

