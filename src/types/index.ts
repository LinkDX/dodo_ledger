// 🐱 Dodo Ledger TypeScript 業務類型定義

export type CatMood = 'happy' | 'nervous' | 'scared' | 'crying' | 'sleeping';

// 使用者全域設定
export interface UserSettings {
  currency: string;
  theme: string;
  monthlyBudget: number;
}

// 本地使用者身分 Profile
export interface UserProfile {
  id: string;
  name: string;
  avatar: string; // 逗逗貓可愛頭像編號或 CSS 漸層色
  createdAt: number;
  settings: UserSettings;
}

// 嚴謹雙層收支分類
export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string; // Lucide 圖示名稱
  subCategories: string[];
}

// 帳戶類型
export type AccountType = 'cash' | 'bank' | 'credit_card' | 'electronic_ticket';

// 信用卡專屬詳細規格
export interface CreditCardDetails {
  creditLimit: number;          // 信用額度
  billingCycleDate: number;     // 每月結帳日 (1-31)
  paymentDueDate: number;       // 每月繳款日 (1-31)
  linkedBankAccountId?: string; // 可綁定自動扣繳的銀行帳戶
}

// 帳戶本體
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;              // 現金、銀行、電子票證為正餘額；信用卡為負之已消費金額
  icon: string;
  color: string;                // 馬卡龍配色 CSS 類別或 Hex
  avatar?: string;              // 可選 Emoji 頭像，方便辨識帳戶
  currency: string;
  createdAt: number;
  cardDetails?: CreditCardDetails;
  updatedAt?: number;           // 最後更新時間戳記 (離線優先防衝突)
}

// 交易類型
export type TransactionType = 'income' | 'expense' | 'transfer';

// 信用卡交易分期與帳單歸屬
export interface CreditCardTxDetails {
  isInstallment: boolean;
  installmentTerm: number;      // 總期數，如 3 期
  currentInstallment: number;   // 當前期數，如 1 期
  billPeriod: string;           // 歸屬帳單月份 (YYYY-MM)，如 2026-05
}

// 交易本體
export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  fee?: number;                 // 轉帳手續費 (轉帳專用)
  category: string;             // 主分類名稱或 ID
  subCategory?: string;         // 子分類名稱或 ID
  fromAccountId?: string;       // 扣款帳戶 ID (支出與轉帳來源)
  toAccountId?: string;         // 存款帳戶 ID (收入與轉帳目的)
  date: number;                 // 交易時間戳記
  note: string;
  tags: string[];
  isRecurring?: boolean;        // 是否為週期扣款自動產生
  recurringId?: string;         // 關聯的週期設定 ID
  createdBy?: string;           // 記帳人暱稱/ID (共同記帳追蹤)
  createdByAvatar?: string;     // 記帳人頭像 (共同記帳追蹤)
  creditCardDetails?: CreditCardTxDetails;
  updatedAt?: number;           // 最後更新時間戳記 (離線優先防衝突)
}

// 週期自動記帳設定
export interface RecurringTransaction {
  id: string;
  title: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  subCategory?: string;
  fromAccountId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;             // 間隔數 (如 1 代表每期，2 代表每兩期)
  startDate: number;
  nextExecutionDate: number;    // 下一次自動扣款時間戳記
  isActive: boolean;
}

// 系統全域操作日誌本體
export interface SystemLog {
  id: string;
  operator: string;
  operatorAvatar: string;
  action: string;
  description: string;
  date: number;
}

// ─── 逗逗貓互動與成就系統 ───

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt?: number;
  icon?: string;
}

export interface CatStats {
  totalPets: number;
  totalFeeds: number;
  totalFish: number;
  totalCans: number;
  streakDays: number;
  lastInteractDate: string; // YYYY-MM-DD
  dailyRecoveryCount: number;
  lastRecoveryDate: string;  // YYYY-MM-DD
}

export interface DodoCatProfile {
  level: number;
  currentXP: number;
  maxXP: number;
  
  energy: {
    current: number;
    max: number;
    lastRefillAt: number;
  };
  
  stats: CatStats;
  unlockedAchievementIds: string[];
  
  // 未來擴充
  equipment?: {
    collarId?: string;
    hatId?: string;
  };
}

