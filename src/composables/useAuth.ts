import { ref, computed } from 'vue'
import type { UserProfile, UserSettings, Category } from '../types'

// 預設的台灣生活化主子分類清單 (符合 SPEC 規格)
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat_food',
    name: '餐飲',
    type: 'expense',
    icon: 'Utensils',
    subCategories: ['早餐', '午餐', '晚餐', '飲料/點心', '買菜食材', '聚餐']
  },
  {
    id: 'cat_trans',
    name: '交通',
    type: 'expense',
    icon: 'Car',
    subCategories: ['捷運/公車', '計程車', '加油/充電', '高鐵/火車', '停車/過路費', '保養維修']
  },
  {
    id: 'cat_shopping',
    name: '購物',
    type: 'expense',
    icon: 'ShoppingBag',
    subCategories: ['日常用品', '服飾配件', '美妝保養', '電子 3C', '家電傢俱']
  },
  {
    id: 'cat_life',
    name: '居住生活',
    type: 'expense',
    icon: 'Home',
    subCategories: ['房租/房貸', '水電瓦斯', '管理費', '網路電話', '醫療保險']
  },
  {
    id: 'cat_fun',
    name: '娛樂休閒',
    type: 'expense',
    icon: 'Sparkles',
    subCategories: ['電影戲劇', '電玩遊戲', '書籍雜誌', '旅行運動', '訂閱服務']
  },
  {
    id: 'cat_salary',
    name: '薪資收入',
    type: 'income',
    icon: 'DollarSign',
    subCategories: ['正職薪資', '兼職副業', '年終獎金', '三節禮金']
  },
  {
    id: 'cat_investment',
    name: '投資理財',
    type: 'income',
    icon: 'TrendingUp',
    subCategories: ['股票股利', '銀行利息', '基金收益', '租金收入']
  },
  {
    id: 'cat_other_income',
    name: '其他收入',
    type: 'income',
    icon: 'Gift',
    subCategories: ['發票中獎', '零用錢', '二手出售', '政府補助']
  }
]

// 儲存所有使用者清單的 LocalStorage Key
const LOCAL_USERS_KEY = 'dodo_ledger_profiles'
// 目前已登入的使用者 ID 的 LocalStorage Key
const CURRENT_USER_ID_KEY = 'dodo_ledger_current_uid'

// 響應式狀態
const profiles = ref<UserProfile[]>([])
const currentProfile = ref<UserProfile | null>(null)

// 載入所有身分列表 (加上 typeof localStorage 嚴格防禦，適配 SSR 與 Node.js 自動化測試)
const loadProfiles = () => {
  if (typeof localStorage === 'undefined') return
  
  const data = localStorage.getItem(LOCAL_USERS_KEY)
  if (data) {
    try {
      profiles.value = JSON.parse(data)
    } catch (e) {
      profiles.value = []
    }
  } else {
    profiles.value = []
  }
  
  // 載入目前選取的身分
  const currentUid = localStorage.getItem(CURRENT_USER_ID_KEY)
  if (currentUid) {
    const found = profiles.value.find(p => p.id === currentUid)
    currentProfile.value = found || null
  } else {
    currentProfile.value = null
  }
}

// 儲存身分列表至本地 (防禦性檢查)
const saveProfiles = () => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(profiles.value))
}

// 建立新主人 (New Profile)
const createProfile = (name: string, avatar: string): UserProfile => {
  const newProfile: UserProfile = {
    id: 'user_local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: name.trim() || '逗逗貓主人',
    avatar: avatar || '🐱',
    createdAt: Date.now(),
    settings: {
      currency: 'TWD',
      theme: 'warm-light',
      monthlyBudget: 20000,
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
    }
  }
  
  profiles.value.push(newProfile)
  saveProfiles()
  
  // 自動登入為新建立的身分
  switchProfile(newProfile.id)
  return newProfile
}

// 切換身分
const switchProfile = (userId: string) => {
  const found = profiles.value.find(p => p.id === userId)
  if (found) {
    currentProfile.value = found
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CURRENT_USER_ID_KEY, userId)
    }
  }
}

// 登出
const logout = () => {
  currentProfile.value = null
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CURRENT_USER_ID_KEY)
  }
}

// 更新設定
const updateProfileSettings = (newSettings: Partial<UserSettings>) => {
  if (!currentProfile.value) return
  
  currentProfile.value.settings = {
    ...currentProfile.value.settings,
    ...newSettings
  }
  
  const idx = profiles.value.findIndex(p => p.id === currentProfile.value?.id)
  if (idx !== -1) {
    profiles.value[idx] = currentProfile.value
    saveProfiles()
  }
}

// 刪除身分
const deleteProfile = (userId: string) => {
  const idx = profiles.value.findIndex(p => p.id === userId)
  if (idx !== -1) {
    profiles.value.splice(idx, 1)
    saveProfiles()
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`dodo_ledger_${userId}_accounts`)
      localStorage.removeItem(`dodo_ledger_${userId}_transactions`)
      localStorage.removeItem(`dodo_ledger_${userId}_recurring`)
    }
    
    if (currentProfile.value?.id === userId) {
      logout()
    }
  }
}

// 僅在具備 localStorage 的環境下執行初始載入
if (typeof localStorage !== 'undefined') {
  loadProfiles()
}

export function useAuth() {
  return {
    profiles: computed(() => profiles.value),
    currentProfile: computed(() => currentProfile.value),
    isLoggedIn: computed(() => currentProfile.value !== null),
    createProfile,
    switchProfile,
    logout,
    updateProfileSettings,
    deleteProfile,
    reloadProfiles: loadProfiles
  }
}
