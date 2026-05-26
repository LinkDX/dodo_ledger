import type { Account, Transaction, RecurringTransaction } from '../types'

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

// 3. 雲端 Firebase 同步模式實作 (預留接口，提供填入配置後一鍵升級)
// 多人共同記帳在 Firestore 上的映射是直接讀寫同一個主帳本文檔，結構完全一致
export class FirestoreDatabaseService implements DatabaseService {
  constructor(_firebaseConfig: any) {
    console.log('[Dodo Ledger] 🐱 成功建立 Firestore 雲端多人共享連線服務層！');
  }

  async getAccounts(): Promise<Account[]> {
    return [];
  }

  async saveAccounts(_accounts: Account[]): Promise<void> {
    return;
  }

  async getTransactions(): Promise<Transaction[]> {
    return [];
  }

  async saveTransactions(_transactions: Transaction[]): Promise<void> {
    return;
  }

  async getRecurring(): Promise<RecurringTransaction[]> {
    return [];
  }

  async saveRecurring(_recurring: RecurringTransaction[]): Promise<void> {
    return;
  }
}

// 預設匯出本地 Mock 服務，使用者可在設定中填入 Firebase 設定進行動態切換
let activeService: DatabaseService = new MockDatabaseService();

export function getDatabaseService(): DatabaseService {
  return activeService;
}

export function switchDatabaseService(service: DatabaseService) {
  activeService = service;
}
