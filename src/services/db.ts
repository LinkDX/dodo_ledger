import type { Account, Transaction, RecurringTransaction, UserProfile, SystemLog, Category, DodoCatProfile } from '../types'
import { initializeApp } from 'firebase/app'
import { doc, collection, getDocs, getDoc, setDoc, deleteDoc, writeBatch, runTransaction, increment, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, onSnapshot } from 'firebase/firestore'
import { FIREBASE_CONFIG } from '../config/firebase'

// ─── 原子操作類型定義 ───

/** 單一餘額增減操作 */
export interface BalanceDelta {
  accountId: string
  delta: number
}

/** 原子寫入操作描述 */
export type AtomicOp =
  | { type: 'addTransaction'; transaction: Transaction }
  | { type: 'deleteTransaction'; transactionId: string }
  | { type: 'updateTransaction'; transactionId: string; data: Partial<Transaction> }
  | { type: 'balanceDelta'; deltas: BalanceDelta[] }
  | { type: 'updateRecurring'; recurringId: string; data: Partial<RecurringTransaction> }

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

  // 🐱 逗逗貓專用 (User 獨立)
  getCatProfile(userId: string): Promise<DodoCatProfile | null>;
  saveCatProfile(userId: string, profile: DodoCatProfile): Promise<void>;
  subscribeCatProfile(userId: string, callback: (profile: DodoCatProfile) => void): () => void;

  // ─── 多人防衝突原子操作 API ───

  /** 單一文件新增（不影響其他文件） */
  addDocument<T extends { id: string }>(colName: string, item: T): Promise<void>;

  /** 單一文件欄位更新（merge，不覆蓋其他欄位） */
  updateDocument<T extends { id: string }>(colName: string, id: string, data: Partial<T>): Promise<void>;

  /** 單一文件刪除（不影響其他文件） */
  deleteDocument(colName: string, id: string): Promise<void>;

  /**
   * 原子批次操作：在單一 Firestore 事務中同時寫入交易 + 帳戶餘額增減。
   * 確保「交易記錄」與「帳戶餘額」在同一原子邊界內一致更新，
   * 避免多裝置並發時產生餘額漂移或孤立交易。
   */
  atomicBatchWrite(ops: AtomicOp[]): Promise<void>;

  /**
   * 條件式新增文件（僅當文件不存在時才寫入）。
   * 用於週期性自動記帳的防重複執行機制。
   * 回傳 true 代表寫入成功（首次執行），false 代表文件已存在（其他裝置已執行）。
   */
  claimDocument<T extends { id: string }>(colName: string, item: T): Promise<boolean>;

  /** 訂閱整個子集合的即時變更（onSnapshot） */
  subscribeCollection<T>(colName: string, callback: (items: T[]) => void): () => void;

  /** 追加單筆系統日誌（不讀取舊資料，避免覆蓋衝突） */
  appendLog(log: SystemLog): Promise<void>;
}


// 2. 本地體驗模式 (LocalStorage 實作，全域共享同一個資產與交易池)
export class MockDatabaseService implements DatabaseService {
  private ACCOUNTS_KEY = 'dodo_ledger_shared_accounts'
  private TRANSACTIONS_KEY = 'dodo_ledger_shared_transactions'
  private RECURRING_KEY = 'dodo_ledger_shared_recurring'
  private CATEGORIES_KEY = 'dodo_ledger_shared_categories'
  private PROFILES_KEY = 'dodo_ledger_shared_profiles'
  private LOGS_KEY = 'dodo_ledger_shared_logs'
  private CAT_PROFILE_PREFIX = 'dodo_ledger_cat_profile_'

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

  async getCatProfile(userId: string): Promise<DodoCatProfile | null> {
    const data = localStorage.getItem(this.CAT_PROFILE_PREFIX + userId)
    if (!data) return null
    try { return JSON.parse(data) } catch { return null }
  }
  async saveCatProfile(userId: string, profile: DodoCatProfile): Promise<void> {
    localStorage.setItem(this.CAT_PROFILE_PREFIX + userId, JSON.stringify(profile))
  }
  subscribeCatProfile(_userId: string, _callback: (profile: DodoCatProfile) => void): () => void {
    return () => {} // 本地模式暫不支援即時監聽
  }

  // ─── 多人防衝突原子操作 API（本地模式以模擬實作） ───

  async addDocument<T extends { id: string }>(colName: string, item: T): Promise<void> {
    const key = this.colNameToKey(colName)
    const arr = this.readKey<T>(key)
    arr.push(item)
    this.writeKey(key, arr)
  }

  async updateDocument<T extends { id: string }>(colName: string, id: string, data: Partial<T>): Promise<void> {
    const key = this.colNameToKey(colName)
    const arr = this.readKey<any>(key)
    const idx = arr.findIndex((item: any) => item.id === id)
    if (idx !== -1) {
      arr[idx] = { ...arr[idx], ...data }
      this.writeKey(key, arr)
    }
  }

  async deleteDocument(colName: string, id: string): Promise<void> {
    const key = this.colNameToKey(colName)
    const arr = this.readKey<any>(key)
    this.writeKey(key, arr.filter((item: any) => item.id !== id))
  }

  async atomicBatchWrite(ops: AtomicOp[]): Promise<void> {
    for (const op of ops) {
      if (op.type === 'addTransaction') {
        await this.addDocument('transactions', op.transaction)
      } else if (op.type === 'deleteTransaction') {
        await this.deleteDocument('transactions', op.transactionId)
      } else if (op.type === 'updateTransaction') {
        await this.updateDocument('transactions', op.transactionId, op.data)
      } else if (op.type === 'balanceDelta') {
        const accounts = this.readKey<Account>(this.ACCOUNTS_KEY)
        for (const { accountId, delta } of op.deltas) {
          const acct = accounts.find(a => a.id === accountId)
          if (acct) {
            acct.balance += delta
            acct.updatedAt = Date.now()
          }
        }
        this.writeKey(this.ACCOUNTS_KEY, accounts)
      } else if (op.type === 'updateRecurring') {
        await this.updateDocument('recurring', op.recurringId, op.data)
      }
    }
  }

  async claimDocument<T extends { id: string }>(colName: string, item: T): Promise<boolean> {
    const key = this.colNameToKey(colName)
    const arr = this.readKey<any>(key)
    if (arr.some((existing: any) => existing.id === item.id)) {
      return false // 已存在，其他裝置已執行
    }
    arr.push(item)
    this.writeKey(key, arr)
    return true
  }

  subscribeCollection<T>(_colName: string, _callback: (items: T[]) => void): () => void {
    return () => {} // 本地模式暫不支援即時監聽
  }

  async appendLog(log: SystemLog): Promise<void> {
    const arr = this.readKey<SystemLog>(this.LOGS_KEY)
    const updated = [log, ...arr].slice(0, 200)
    this.writeKey(this.LOGS_KEY, updated)
  }

  /** 將集合名稱對應到 localStorage key */
  private colNameToKey(colName: string): string {
    const map: Record<string, string> = {
      accounts: this.ACCOUNTS_KEY,
      transactions: this.TRANSACTIONS_KEY,
      recurring: this.RECURRING_KEY,
      categories: this.CATEGORIES_KEY,
      profiles: this.PROFILES_KEY,
      logs: this.LOGS_KEY
    }
    return map[colName] || `dodo_ledger_shared_${colName}`
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

  async getCatProfile(userId: string): Promise<DodoCatProfile | null> {
    try {
      const docRef = doc(this.col('catProfiles'), userId)
      const snap = await getDoc(docRef)
      return snap.exists() ? snap.data() as DodoCatProfile : null
    } catch (e) {
      console.error(`[Dodo Ledger] 讀取貓咪設定檔失敗 (userId: ${userId})：`, e)
      return null
    }
  }

  async saveCatProfile(userId: string, profile: DodoCatProfile): Promise<void> {
    try {
      const docRef = doc(this.col('catProfiles'), userId)
      await setDoc(docRef, stripUndefined(profile))
    } catch (e) {
      console.error(`[Dodo Ledger] 儲存貓咪設定檔失敗 (userId: ${userId})：`, e)
    }
  }

  subscribeCatProfile(userId: string, callback: (profile: DodoCatProfile) => void): () => void {
    const docRef = doc(this.col('catProfiles'), userId)
    return onSnapshot(docRef, (snap: any) => {
      if (snap.exists()) {
        callback(snap.data() as DodoCatProfile)
      }
    })
  }

  // ─── 多人防衝突原子操作 API（Firestore 真正原子實作） ───

  async addDocument<T extends { id: string }>(colName: string, item: T): Promise<void> {
    try {
      const docRef = doc(this.col(colName), item.id)
      await setDoc(docRef, stripUndefined(item))
    } catch (e) {
      console.error(`[Dodo Ledger] 新增文件 ${colName}/${item.id} 失敗：`, e)
    }
  }

  async updateDocument<T extends { id: string }>(colName: string, id: string, data: Partial<T>): Promise<void> {
    try {
      const docRef = doc(this.col(colName), id)
      await setDoc(docRef, stripUndefined(data), { merge: true })
    } catch (e) {
      console.error(`[Dodo Ledger] 更新文件 ${colName}/${id} 失敗：`, e)
    }
  }

  async deleteDocument(colName: string, id: string): Promise<void> {
    try {
      const docRef = doc(this.col(colName), id)
      await deleteDoc(docRef)
    } catch (e) {
      console.error(`[Dodo Ledger] 刪除文件 ${colName}/${id} 失敗：`, e)
    }
  }

  async atomicBatchWrite(ops: AtomicOp[]): Promise<void> {
    try {
      const batch = writeBatch(this.db)

      for (const op of ops) {
        if (op.type === 'addTransaction') {
          const ref = doc(this.col('transactions'), op.transaction.id)
          batch.set(ref, stripUndefined(op.transaction))
        } else if (op.type === 'deleteTransaction') {
          const ref = doc(this.col('transactions'), op.transactionId)
          batch.delete(ref)
        } else if (op.type === 'updateTransaction') {
          const ref = doc(this.col('transactions'), op.transactionId)
          batch.set(ref, stripUndefined(op.data), { merge: true })
        } else if (op.type === 'balanceDelta') {
          for (const { accountId, delta } of op.deltas) {
            const ref = doc(this.col('accounts'), accountId)
            batch.set(ref, { balance: increment(delta), updatedAt: Date.now() }, { merge: true })
          }
        } else if (op.type === 'updateRecurring') {
          const ref = doc(this.col('recurring'), op.recurringId)
          batch.set(ref, stripUndefined(op.data), { merge: true })
        }
      }

      await batch.commit()
    } catch (e) {
      console.error('[Dodo Ledger] 原子批次寫入失敗：', e)
    }
  }

  async claimDocument<T extends { id: string }>(colName: string, item: T): Promise<boolean> {
    try {
      const docRef = doc(this.col(colName), item.id)
      let claimed = false

      await runTransaction(this.db, async (transaction) => {
        const snap = await transaction.get(docRef)
        if (snap.exists()) {
          claimed = false
        } else {
          transaction.set(docRef, stripUndefined(item))
          claimed = true
        }
      })

      return claimed
    } catch (e) {
      console.error(`[Dodo Ledger] 條件寫入 ${colName}/${item.id} 失敗：`, e)
      return false
    }
  }

  subscribeCollection<T>(colName: string, callback: (items: T[]) => void): () => void {
    const colRef = this.col(colName)
    return onSnapshot(colRef, (snap: any) => {
      const items = snap.docs.map((d: any) => d.data() as T)
      callback(items)
    })
  }

  async appendLog(log: SystemLog): Promise<void> {
    try {
      const docRef = doc(this.col('logs'), log.id)
      await setDoc(docRef, stripUndefined(log))
    } catch (e) {
      console.error('[Dodo Ledger] 追加系統日誌失敗：', e)
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

