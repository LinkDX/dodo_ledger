import type { Account, Transaction, RecurringTransaction, UserProfile, SystemLog, Category } from '../types'
import { initializeApp } from 'firebase/app'
import { doc, collection, getDocs, writeBatch, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { FIREBASE_CONFIG } from '../config/firebase'

// 1. 抽象資料庫服務介面 (多人共同記帳模型，維護同一個資產紀錄)
export interface DatabaseService {
  getAccounts(): Promise<Account[]>;
  saveAccounts(accounts: Account[]): Promise<void>;
  
  getTransactions(): Promise<Transaction[]>;
  saveTransactions(transactions: Transaction[]): Promise<void>;
  
  getRecurring(): Promise<RecurringTransaction[]>;
  saveRecurring(recurring: RecurringTransaction[]): Promise<void>;

  getCategories(): Promise<Category[]>;
  saveCategories(categories: Category[]): Promise<void>;

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
  private CATEGORIES_KEY = 'dodo_ledger_shared_categories'
  private PROFILES_KEY = 'dodo_ledger_shared_profiles'
  private LOGS_KEY = 'dodo_ledger_shared_logs'

  private readKey<T>(key: string): T[] {
    if (typeof localStorage === 'undefined') return []
    const data = localStorage.getItem(key)
    if (!data) return []
    try { return JSON.parse(data) } catch { return [] }
  }

  private writeKey<T>(key: string, value: T[]): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(value))
  }

  async getAccounts(): Promise<Account[]> { return this.readKey(this.ACCOUNTS_KEY) }
  async saveAccounts(accounts: Account[]): Promise<void> { this.writeKey(this.ACCOUNTS_KEY, accounts) }

  async getTransactions(): Promise<Transaction[]> { return this.readKey(this.TRANSACTIONS_KEY) }
  async saveTransactions(transactions: Transaction[]): Promise<void> { this.writeKey(this.TRANSACTIONS_KEY, transactions) }

  async getRecurring(): Promise<RecurringTransaction[]> { return this.readKey(this.RECURRING_KEY) }
  async saveRecurring(recurring: RecurringTransaction[]): Promise<void> { this.writeKey(this.RECURRING_KEY, recurring) }

  async getCategories(): Promise<Category[]> { return this.readKey(this.CATEGORIES_KEY) }
  async saveCategories(categories: Category[]): Promise<void> { this.writeKey(this.CATEGORIES_KEY, categories) }

  async getProfiles(): Promise<UserProfile[]> { return this.readKey(this.PROFILES_KEY) }
  async saveProfiles(profiles: UserProfile[]): Promise<void> { this.writeKey(this.PROFILES_KEY, profiles) }

  async getLogs(): Promise<SystemLog[]> { return this.readKey(this.LOGS_KEY) }
  async saveLogs(logs: SystemLog[]): Promise<void> { this.writeKey(this.LOGS_KEY, logs) }
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

// 3. 雲端 Firebase 同步模式實作 (多人共同記帳 Firestore 正規化子集合架構)
// 每種實體各自儲存於 ledgers/dodo_shared_ledger/{collectionName}/{id} 的子集合，
// 避免單一文件超過 Firestore 1MB 上限，並支援未來擴充即時監聽與分頁查詢。
export class FirestoreDatabaseService implements DatabaseService {
  private db: any
  private ledgerId = 'dodo_shared_ledger'

  constructor(firebaseConfig: any) {
    const app = initializeApp(firebaseConfig)
    
    // 啟用具有 IndexedDB 的離線持久化本地快取，支援多分頁/多 WebView 快取安全鎖
    this.db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    })
    
    console.log('[Dodo Ledger] 🐱 成功啟用離線快取 (IndexedDB) 並初始化 Firestore 雲端服務層！');
  }

  /** 取得子集合參考 */
  private col(name: string) {
    return collection(this.db, 'ledgers', this.ledgerId, name)
  }

  /** 通用：讀取子集合全量文件 */
  private async readCollection<T>(colName: string): Promise<T[]> {
    try {
      const snap = await getDocs(this.col(colName))
      return snap.docs.map(d => d.data() as T)
    } catch (e) {
      console.error(`[Dodo Ledger] 讀取子集合 ${colName} 失敗：`, e)
      return []
    }
  }

  /**
   * 通用：以 writeBatch 取代子集合全量文件。
   * 先刪除舊 ID 不在新陣列中的文件，再寫入所有新文件。
   * 每批次最多 500 次操作以符合 Firestore 限制。
   */
  private async writeCollection<T extends { id: string }>(colName: string, items: T[]): Promise<void> {
    try {
      const colRef = this.col(colName)
      const snap = await getDocs(colRef)

      const newIdSet = new Set(items.map(i => i.id))
      const toDelete = snap.docs.filter(d => !newIdSet.has(d.id))

      // 合併刪除 + 寫入操作，每 500 個一批
      type Op = { op: 'delete'; ref: any } | { op: 'set'; ref: any; data: any }
      const ops: Op[] = [
        ...toDelete.map(d => ({ op: 'delete' as const, ref: d.ref })),
        ...items.map(item => ({
          op: 'set' as const,
          ref: doc(colRef, item.id),
          data: stripUndefined(item)
        }))
      ]

      for (let i = 0; i < ops.length; i += 500) {
        const batch = writeBatch(this.db)
        for (const entry of ops.slice(i, i + 500)) {
          if (entry.op === 'delete') batch.delete(entry.ref)
          else batch.set(entry.ref, entry.data)
        }
        await batch.commit()
      }
    } catch (e) {
      console.error(`[Dodo Ledger] 寫入子集合 ${colName} 失敗：`, e)
    }
  }

  async getAccounts(): Promise<Account[]> { return this.readCollection('accounts') }
  async saveAccounts(accounts: Account[]): Promise<void> { await this.writeCollection('accounts', accounts) }

  async getTransactions(): Promise<Transaction[]> { return this.readCollection('transactions') }
  async saveTransactions(transactions: Transaction[]): Promise<void> { await this.writeCollection('transactions', transactions) }

  async getRecurring(): Promise<RecurringTransaction[]> { return this.readCollection('recurring') }
  async saveRecurring(recurring: RecurringTransaction[]): Promise<void> { await this.writeCollection('recurring', recurring) }

  async getCategories(): Promise<Category[]> { return this.readCollection('categories') }
  async saveCategories(categories: Category[]): Promise<void> { await this.writeCollection('categories', categories) }

  async getProfiles(): Promise<UserProfile[]> { return this.readCollection('profiles') }
  async saveProfiles(profiles: UserProfile[]): Promise<void> { await this.writeCollection('profiles', profiles) }

  async getLogs(): Promise<SystemLog[]> { return this.readCollection('logs') }
  async saveLogs(logs: SystemLog[]): Promise<void> { await this.writeCollection('logs', logs) }
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

