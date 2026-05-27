import { ref, computed } from 'vue'
import type { UserProfile, UserSettings, Category } from '../types'
import { getDatabaseService, addSystemLog } from '../services/db'

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
const isLoading = ref(true)

// 載入所有身分列表 (從資料庫拉取，並向後相容本地 localStorage)
const loadProfiles = async () => {
  isLoading.value = true
  const dbService = getDatabaseService()
  let loadedProfiles: UserProfile[] = []
  
  try {
    loadedProfiles = await dbService.getProfiles()
  } catch (e) {
    console.error('[Dodo Ledger] 無法從雲端或本地資料庫載入 Profiles：', e)
  }
  
  // 向後相容或本地備份
  if ((!loadedProfiles || loadedProfiles.length === 0) && typeof localStorage !== 'undefined') {
    const data = localStorage.getItem(LOCAL_USERS_KEY)
    if (data) {
      try {
        loadedProfiles = JSON.parse(data)
      } catch (e) {
        loadedProfiles = []
      }
    }
  }
  
  profiles.value = loadedProfiles || []
  
  // 載入目前選取的身分
  if (typeof localStorage !== 'undefined') {
    const currentUid = localStorage.getItem(CURRENT_USER_ID_KEY)
    if (currentUid) {
      const found = profiles.value.find(p => p.id === currentUid)
      currentProfile.value = found || null
    } else {
      currentProfile.value = null
    }
  } else {
    currentProfile.value = null
  }
  
  isLoading.value = false
}

// 儲存身分列表至本地與資料庫
const saveProfiles = async () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(profiles.value))
  }
  
  const dbService = getDatabaseService()
  try {
    await dbService.saveProfiles(profiles.value)
  } catch (e) {
    console.error('[Dodo Ledger] 同步儲存 Profiles 失敗：', e)
  }
}

// 建立新主人 (New Profile)
const createProfile = async (name: string, avatar: string): Promise<UserProfile> => {
  const newProfile: UserProfile = {
    id: 'user_local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: name.trim() || '逗逗貓主人',
    avatar: avatar || '🐱',
    createdAt: Date.now(),
    settings: {
      currency: 'TWD',
      theme: 'warm-light',
      monthlyBudget: 20000
    }
  }
  
  profiles.value.push(newProfile)
  await saveProfiles()
  
  // 自動登入為新建立的身分
  switchProfile(newProfile.id)
  
  // 寫入系統日誌
  await addSystemLog(
    '系統自動',
    '⚙️',
    'create_profile',
    `建立了新成員身分「${newProfile.name}」`
  )
  
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

// 更新設定 (支援預算變更日誌)
const updateProfileSettings = async (newSettings: Partial<UserSettings>) => {
  if (!currentProfile.value) return
  
  const oldBudget = currentProfile.value.settings.monthlyBudget
  const isBudgetChanged = newSettings.monthlyBudget !== undefined && newSettings.monthlyBudget !== oldBudget
  
  currentProfile.value.settings = {
    ...currentProfile.value.settings,
    ...newSettings
  }
  
  const idx = profiles.value.findIndex(p => p.id === currentProfile.value?.id)
  if (idx !== -1) {
    profiles.value[idx] = currentProfile.value
    await saveProfiles()
    
    if (isBudgetChanged) {
      await addSystemLog(
        currentProfile.value.name,
        currentProfile.value.avatar,
        'update_budget',
        `將每月預算從 ${oldBudget} 元調整為 ${newSettings.monthlyBudget} 元`
      )
    }
  }
}

// 更換頭像
const updateProfileAvatar = async (newAvatar: string) => {
  if (!currentProfile.value) return
  const oldAvatar = currentProfile.value.avatar
  currentProfile.value.avatar = newAvatar
  const idx = profiles.value.findIndex(p => p.id === currentProfile.value?.id)
  if (idx !== -1) {
    profiles.value[idx] = currentProfile.value
    await saveProfiles()
    await addSystemLog(
      currentProfile.value.name,
      newAvatar,
      'update_avatar',
      `將頭像從 ${oldAvatar} 更換為 ${newAvatar}`
    )
  }
}

// 刪除身分
const deleteProfile = async (userId: string) => {
  const idx = profiles.value.findIndex(p => p.id === userId)
  if (idx !== -1) {
    const deletedName = profiles.value[idx].name
    const operatorName = currentProfile.value?.name || '系統自動'
    const operatorAvatar = currentProfile.value?.avatar || '⚙️'
    
    profiles.value.splice(idx, 1)
    await saveProfiles()
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`dodo_ledger_${userId}_accounts`)
      localStorage.removeItem(`dodo_ledger_${userId}_transactions`)
      localStorage.removeItem(`dodo_ledger_${userId}_recurring`)
    }
    
    if (currentProfile.value?.id === userId) {
      logout()
    }
    
    // 寫入系統日誌
    await addSystemLog(
      operatorName,
      operatorAvatar,
      'delete_profile',
      `刪除了成員身分「${deletedName}」`
    )
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
    isLoading: computed(() => isLoading.value),
    createProfile,
    switchProfile,
    logout,
    updateProfileSettings,
    updateProfileAvatar,
    deleteProfile,
    reloadProfiles: loadProfiles
  }
}
