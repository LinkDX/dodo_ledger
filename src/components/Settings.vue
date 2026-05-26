<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { getDatabaseService, FirestoreDatabaseService } from '../services/db'
import type { Category } from '../types'
import { 
  Settings as SettingsIcon, 
  Sparkles, 
  CloudLightning,
  Cloud,
  CheckCircle,
  ShieldCheck,
  BadgeAlert,
  Trash2,
  FolderPlus,
  X
} from 'lucide-vue-next'

const { currentProfile, updateProfileSettings } = useAuth()

// 🔒 Dodo Gatekeeper - 密碼鎖防護邏輯
import { useAppLock } from '../composables/useAppLock'
const { 
  hasLocalPassword, 
  isGlobalLockEnabled, 
  setupLocalPassword, 
  disableLocalPassword,
  lockApp 
} = useAppLock()

const showLockModal = ref(false)
const lockActionType = ref<'enable' | 'disable' | 'change'>('enable')
const lockInputPwd = ref('')
const lockInputConfirm = ref('')
const lockModalError = ref('')

const openLockModal = (action: 'enable' | 'disable' | 'change') => {
  lockActionType.value = action
  lockInputPwd.value = ''
  lockInputConfirm.value = ''
  lockModalError.value = ''
  showLockModal.value = true
}

const handleLockSubmit = async () => {
  lockModalError.value = ''
  
  if (lockActionType.value === 'enable' || lockActionType.value === 'change') {
    if (lockInputPwd.value.length < 4 || lockInputPwd.value.length > 8) {
      lockModalError.value = '密碼長度必須介於 4 到 8 位數之間喵！'
      return
    }
    if (!/^\d+$/.test(lockInputPwd.value)) {
      lockModalError.value = '密碼只能包含數字喔喵！'
      return
    }
    if (lockInputPwd.value !== lockInputConfirm.value) {
      lockModalError.value = '兩次輸入的密碼不一致，請再確認一下喵！'
      return
    }
    
    await setupLocalPassword(lockInputPwd.value)
    showLockModal.value = false
    alert('🔒 密碼設定成功！從現在起每次開啟本網頁，都會被安全保護囉！')
  } else if (lockActionType.value === 'disable') {
    const success = await disableLocalPassword(lockInputPwd.value)
    if (success) {
      showLockModal.value = false
      alert('🔓 本地密碼保護已成功停用，金庫已解鎖。')
    } else {
      lockModalError.value = '密碼不正確，無法解鎖金庫喵！'
    }
  }
}

const handleImmediateLock = () => {
  lockApp()
}

// 1. 預算設定狀態
const budgetVal = ref<number>(currentProfile.value?.settings.monthlyBudget || 20000)
const isSavedSuccess = ref(false)

const handleSaveBudget = () => {
  updateProfileSettings({
    monthlyBudget: Number(budgetVal.value) || 20000
  })
  isSavedSuccess.value = true
  setTimeout(() => {
    isSavedSuccess.value = false
  }, 3000)
}

// 2. Firebase 雲端同步狀態
const isCurrentlyCloudMode = ref(getDatabaseService() instanceof FirestoreDatabaseService)

// 3. 🐾 記帳分類手動管理狀態與方法
const activeCatType = ref<'expense' | 'income'>('expense')
const expandedCatId = ref<string>('')

// 設置預設展開第一個主分類
if (currentProfile.value?.settings.categories && currentProfile.value.settings.categories.length > 0) {
  const initialCat = currentProfile.value.settings.categories.find(c => c.type === activeCatType.value)
  if (initialCat) expandedCatId.value = initialCat.id
}

// 監聽類型切換，自動展開該類型的第一個主分類
watch(activeCatType, (newType) => {
  if (currentProfile.value) {
    const found = currentProfile.value.settings.categories.find(c => c.type === newType)
    expandedCatId.value = found ? found.id : ''
  }
})

const toggleExpandCat = (catId: string) => {
  expandedCatId.value = expandedCatId.value === catId ? '' : catId
}

// 新增主分類狀態
const showAddCatForm = ref(false)
const newCatName = ref('')
const newCatIcon = ref('Sparkles')
const cuteIconsList = ['Sparkles', 'Utensils', 'Car', 'ShoppingBag', 'Home', 'DollarSign', 'TrendingUp', 'Gift', 'Briefcase', 'Heart', 'Smile', 'Activity']

const handleAddMainCategory = () => {
  if (!newCatName.value.trim() || !currentProfile.value) return
  
  const cats = [...currentProfile.value.settings.categories]
  const newId = 'cat_custom_' + Date.now()
  const newCat: Category = {
    id: newId,
    name: newCatName.value.trim(),
    type: activeCatType.value,
    icon: newCatIcon.value,
    subCategories: []
  }
  
  cats.push(newCat)
  updateProfileSettings({ categories: cats })
  
  newCatName.value = ''
  showAddCatForm.value = false
  expandedCatId.value = newId // 自動展開新建立的分類
  alert(`🐱 成功新增主分類「${newCat.name}」主機！`)
}

const handleDeleteMainCategory = (catId: string) => {
  if (!currentProfile.value) return
  const cat = currentProfile.value.settings.categories.find(c => c.id === catId)
  if (!cat) return
  
  if (!confirm(`確定要刪除「${cat.name}」主分類及其底下所有子分類嗎喵？（已記帳交易不受影響）`)) {
    return
  }
  
  const cats = currentProfile.value.settings.categories.filter(c => c.id !== catId)
  updateProfileSettings({ categories: cats })
  
  if (expandedCatId.value === catId) {
    const nextCat = cats.find(c => c.type === activeCatType.value)
    expandedCatId.value = nextCat ? nextCat.id : ''
  }
  alert(`🐱 主分類「${cat.name}」已被刪除。`)
}

// 子分類狀態與方法
const newSubCatName = ref<Record<string, string>>({})

const handleAddSubCategory = (catId: string) => {
  const subName = (newSubCatName.value[catId] || '').trim()
  if (!subName || !currentProfile.value) return
  
  const cats = currentProfile.value.settings.categories.map(c => {
    if (c.id === catId) {
      if (c.subCategories.includes(subName)) {
        alert('🐱 這個子分類已經存在囉喵！')
        return c
      }
      return {
        ...c,
        subCategories: [...c.subCategories, subName]
      }
    }
    return c
  })
  
  updateProfileSettings({ categories: cats })
  newSubCatName.value[catId] = ''
}

const handleDeleteSubCategory = (catId: string, subName: string) => {
  if (!currentProfile.value) return
  
  const cats = currentProfile.value.settings.categories.map(c => {
    if (c.id === catId) {
      return {
        ...c,
        subCategories: c.subCategories.filter(s => s !== subName)
      }
    }
    return c
  })
  
  updateProfileSettings({ categories: cats })
}

// 格式化千分位金額
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
}
</script>

<template>
  <div class="settings-page pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><SettingsIcon class="icon-inline" /> 設定與雲端備份</h2>
      <p class="page-subtitle">管理您的記帳預算，並一鍵備份同步至 Firebase 雲端</p>
    </div>

    <!-- 1. 每月收支預算設定 -->
    <div class="settings-box card-jelly">
      <h3 class="box-title"><Sparkles class="icon-inline" /> 理財月預算設定</h3>
      
      <div class="form-group">
        <label class="label-cute">本月記帳總預算 (TWD)</label>
        <div class="budget-input-row">
          <input 
            v-model="budgetVal" 
            type="number" 
            placeholder="20000" 
            class="input-jelly budget-input" 
          />
          <button class="btn-jelly btn-save-budget" @click="handleSaveBudget">
            儲存預算 🐾
          </button>
        </div>
        
        <Transition name="fade-success">
          <div v-if="isSavedSuccess" class="save-success-badge pop-jelly">
            <CheckCircle :size="12" /> 喵！預算更新成功！
          </div>
        </Transition>
      </div>

      <div class="budget-desc-card">
        <p class="desc-text">
          目前預算：<span class="desc-bold">${{ formatCurrency(currentProfile?.settings.monthlyBudget || 20000) }} 元</span>
        </p>
        <p class="desc-hint">
          * 逗逗貓會根據這個預算數值，在首頁療癒生活秀中展示微笑、流汗、或抓狂遮眼大哭的可愛狀態喔喵！
        </p>
      </div>
    </div>

    <!-- 2. Firebase 雲端同步狀態 -->
    <div class="settings-box card-jelly">
      <h3 class="box-title">
        <CloudLightning class="icon-inline" /> Firebase 雲端備份防護
      </h3>

      <!-- 雲端狀態橫條 -->
      <div 
        class="cloud-status-badge card-jelly"
        :class="{ 'cloud-active': isCurrentlyCloudMode, 'cloud-inactive': !isCurrentlyCloudMode }"
      >
        <div class="status-left">
          <Cloud v-if="isCurrentlyCloudMode" :size="20" class="icon-cloud" />
          <CloudLightning v-else :size="20" class="icon-cloud" />
          <span class="status-text">
            儲存狀態: {{ isCurrentlyCloudMode ? '☁️ Firebase 雲端同步模式' : '📟 LocalStorage 本地儲存模式' }}
          </span>
        </div>
      </div>

      <!-- 雲端狀態說明 -->
      <div v-if="isCurrentlyCloudMode" class="cloud-connected-info pop-jelly">
        <div class="shield-success-card card-jelly">
          <ShieldCheck :size="32" class="icon-shield" />
          <h4>雲端防護已自動啟動！</h4>
          <p class="shield-desc">
            偵測到專案內置的 Firebase 金鑰設定。您的記帳資料已自動在 Firebase Firestore 進行安全的雲端即時同步備份與多人共同記帳保護，未來的 Android App 也將能無縫共享資料喔喵！🐾
          </p>
        </div>
      </div>

      <div v-else class="cloud-connected-info pop-jelly">
        <div class="inner-config-card card-jelly" style="background-color: #FFF0ED !important; border-color: #FFAAAA !important; text-align: left;">
          <div class="config-icon">📟</div>
          <div class="config-details">
            <h4 class="config-title" style="color: #B4463E;">本地離線記帳中</h4>
            <p class="shield-desc" style="margin-top: 4px; color: var(--color-text-muted);">
              目前未使用雲端。您的所有記帳與資產紀錄皆安全地儲存在您本機瀏覽器的 LocalStorage 裡。若要開啟多人雲端共同記帳，請在發布時配置 Firebase 金鑰，系統即會自動上雲同步喵！
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 🔒 3. Dodo Gatekeeper 安全防護與密碼鎖 -->
    <div class="settings-box card-jelly">
      <h3 class="box-title">
        <ShieldCheck class="icon-inline" /> 🔒 應用安全防護門禁
      </h3>
      
      <p class="categories-preview-hint">
        為您的記帳本加上一道鎖，防止別人在同台電腦或透過網址直接進入您的私密金庫。
      </p>

      <div class="lock-status-card card-jelly" :class="{ 'lock-active-border': hasLocalPassword || isGlobalLockEnabled }">
        <div class="status-left-lock">
          <span class="status-icon">
            <ShieldCheck v-if="hasLocalPassword || isGlobalLockEnabled" :size="20" style="color: #2EB086" />
            <BadgeAlert v-else :size="20" style="color: #FF5A5A" />
          </span>
          <div class="status-info">
            <h4 class="status-title-text">
              防護狀態：{{ isGlobalLockEnabled ? '全域金鑰保護中' : hasLocalPassword ? '本地密碼鎖啟用中' : '無密碼保護 (不安全)' }}
            </h4>
            <p class="status-desc-text">
              {{ isGlobalLockEnabled ? '此系統已被全域環境變數鎖定，未授權者無法存取。' : hasLocalPassword ? '每次開啟本網頁時，都必須輸入您設定的專屬數字密碼。' : '目前任何人只要知道此網址即可直接進入並檢視您的資料，建議立刻開啟密碼鎖。' }}
            </p>
          </div>
        </div>
      </div>

      <div class="lock-actions-row">
        <!-- 情況 A: 全域鎖定中 -->
        <div v-if="isGlobalLockEnabled" class="global-lock-notice">
          🛡️ 系統已受全域打包金鑰防護，無法於此處修改密碼。
        </div>
        
        <!-- 情況 B: 本地密碼操作 -->
        <div v-else class="local-actions-flex">
          <button 
            v-if="!hasLocalPassword" 
            class="btn-jelly btn-lock-primary"
            @click="openLockModal('enable')"
          >
            🔑 開啟本地密碼鎖
          </button>
          
          <template v-else>
            <button 
              class="btn-jelly btn-lock-secondary"
              @click="openLockModal('change')"
            >
              🔄 修改密碼
            </button>
            <button 
              class="btn-jelly btn-lock-danger"
              @click="openLockModal('disable')"
            >
              🔓 關閉密碼鎖
            </button>
            <button 
              class="btn-jelly btn-lock-test"
              @click="handleImmediateLock"
            >
              🐱 立即測試鎖定
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 🔒 密碼設定/驗證彈窗 Modal (Jelly Style) -->
    <Transition name="bubble-fade">
      <div v-if="showLockModal" class="lock-modal-overlay">
        <div class="lock-modal-card pop-jelly">
          <div class="modal-header">
            <h4>
              {{ lockActionType === 'enable' ? '🔑 開啟密碼保護' : lockActionType === 'change' ? '🔄 修改防護密碼' : '🔓 關閉密碼保護' }}
            </h4>
            <button class="btn-close-modal" @click="showLockModal = false">
              <X :size="18" />
            </button>
          </div>
          
          <div class="modal-body">
            <p class="modal-body-tip">
              {{ lockActionType === 'enable' ? '請設定一個 4 到 8 位數的「數字解鎖密碼」，此密碼將以安全雜湊儲存在您的瀏覽器中。' : lockActionType === 'change' ? '請輸入您的新數字密碼，並再次確認。' : '請輸入您當前的密碼以確認關閉安全鎖。' }}
            </p>
            
            <div class="form-group margin-top-sm">
              <label class="label-cute">
                {{ lockActionType === 'disable' ? '請輸入當前密碼' : '輸入新密碼 (4~8位數字)' }}
              </label>
              <input 
                v-model="lockInputPwd"
                type="password" 
                pattern="[0-9]*"
                inputmode="numeric"
                placeholder="••••" 
                class="input-jelly text-center" 
                maxlength="8"
                @keyup.enter="handleLockSubmit"
              />
            </div>
            
            <div v-if="lockActionType !== 'disable'" class="form-group">
              <label class="label-cute">再次確認新密碼</label>
              <input 
                v-model="lockInputConfirm"
                type="password" 
                pattern="[0-9]*"
                inputmode="numeric"
                placeholder="••••" 
                class="input-jelly text-center" 
                maxlength="8"
                @keyup.enter="handleLockSubmit"
              />
            </div>

            <div v-if="lockModalError" class="modal-error-msg pop-jelly">
              ⚠️ {{ lockModalError }}
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-jelly btn-cancel-cat" @click="showLockModal = false">
              取消 🐾
            </button>
            <button 
              class="btn-jelly btn-save-cat"
              :disabled="!lockInputPwd || (lockActionType !== 'disable' && !lockInputConfirm)" 
              @click="handleLockSubmit"
            >
              {{ lockActionType === 'disable' ? '確認關閉' : '儲存設定' }} 🐾
            </button>
          </div>
        </div>
      </div>
    </Transition>


    <!-- 3. 自訂分類手動管理面板 (🐾 記帳分類管理大師) -->
    <div class="settings-box card-jelly">
      <h3 class="box-title"><FolderPlus :size="16" class="icon-inline" /> 🐾 記帳分類管理大師</h3>
      <p class="categories-preview-hint">
        在這裡您可以自由管理您的雙層記帳主子分類，所有變更將在記帳時立即生效喔喵！
      </p>
      
      <!-- 支出/收入分類切換 Tab -->
      <div class="category-tabs-row">
        <button 
          class="btn-jelly btn-cat-tab"
          :class="{ active: activeCatType === 'expense' }"
          @click="activeCatType = 'expense'"
        >
          🔴 支出分類
        </button>
        <button 
          class="btn-jelly btn-cat-tab"
          :class="{ active: activeCatType === 'income' }"
          @click="activeCatType = 'income'"
        >
          🟢 收入分類
        </button>
      </div>
      
      <!-- 主分類摺疊卡片清單 -->
      <div class="cat-accordion-list">
        <div 
          v-for="cat in currentProfile?.settings.categories.filter(c => c.type === activeCatType)"
          :key="cat.id"
          class="cat-accordion-item card-jelly"
          :class="{ 'expanded': expandedCatId === cat.id }"
        >
          <!-- 卡片 Header：點擊展開子分類 -->
          <div class="accordion-header" @click="toggleExpandCat(cat.id)">
            <div class="header-left">
              <span class="cat-icon-emoji">
                {{ cat.icon === 'Utensils' ? '🍔' : cat.icon === 'Car' ? '🚗' : cat.icon === 'ShoppingBag' ? '🛍️' : cat.icon === 'Home' ? '🏠' : cat.icon === 'DollarSign' ? '💵' : cat.icon === 'TrendingUp' ? '📈' : cat.icon === 'Gift' ? '🎁' : cat.icon === 'Briefcase' ? '💼' : cat.icon === 'Heart' ? '❤️' : cat.icon === 'Smile' ? '😊' : cat.icon === 'Activity' ? '🏥' : '✨' }}
              </span>
              <span class="cat-name-bold">{{ cat.name }}</span>
              <span class="sub-count-tag tag-jelly">{{ cat.subCategories.length }} 個子類</span>
            </div>
            <div class="header-right">
              <button 
                class="btn-delete-cat" 
                title="刪除此主分類" 
                @click.stop="handleDeleteMainCategory(cat.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
          
          <!-- 卡片 Body：展開顯示子分類列表與新增 -->
          <div v-if="expandedCatId === cat.id" class="accordion-body pop-jelly">
            <div class="sub-categories-wrapper">
              <div v-if="cat.subCategories.length === 0" class="empty-sub-hint">
                目前尚未有任何子分類喵，請在下方輸入新增🐾
              </div>
              <div v-else class="sub-pills-list">
                <span 
                  v-for="sub in cat.subCategories" 
                  :key="sub"
                  class="tag-jelly sub-cute-pill"
                >
                  {{ sub }}
                  <button class="btn-remove-sub" @click="handleDeleteSubCategory(cat.id, sub)">
                    <X :size="10" />
                  </button>
                </span>
              </div>
              
              <!-- 新增子分類小輸入框 -->
              <div class="add-sub-row">
                <input 
                  v-model="newSubCatName[cat.id]"
                  type="text" 
                  placeholder="新增子分類..." 
                  class="input-jelly input-sub-cute"
                  @keyup.enter="handleAddSubCategory(cat.id)"
                />
                <button class="btn-jelly btn-add-sub" @click="handleAddSubCategory(cat.id)">
                  ➕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 新增主分類控制列 -->
      <div v-if="!showAddCatForm" class="add-main-cat-trigger">
        <button class="btn-jelly btn-add-main-trigger" @click="showAddCatForm = true">
          ➕ 新增自訂主分類 🐾
        </button>
      </div>
      
      <div v-else class="add-main-cat-form card-jelly pop-jelly">
        <h4>➕ 新增 {{ activeCatType === 'expense' ? '支出' : '收入' }} 主分類</h4>
        
        <div class="form-group margin-top-sm">
          <label class="label-cute">主分類名稱</label>
          <input 
            v-model="newCatName" 
            type="text" 
            placeholder="例如：寵物開銷、人情紅包" 
            class="input-jelly" 
            @keyup.enter="handleAddMainCategory"
          />
        </div>
        
        <!-- 可選的可愛圖示列表 -->
        <div class="form-group">
          <label class="label-cute">選擇主分類圖示</label>
          <div class="icon-selector-grid">
            <button 
              v-for="ico in cuteIconsList" 
              :key="ico"
              class="btn-jelly btn-icon-select"
              :class="{ active: newCatIcon === ico }"
              @click="newCatIcon = ico"
            >
              {{ ico === 'Utensils' ? '🍔' : ico === 'Car' ? '🚗' : ico === 'ShoppingBag' ? '🛍️' : ico === 'Home' ? '🏠' : ico === 'DollarSign' ? '💵' : ico === 'TrendingUp' ? '📈' : ico === 'Gift' ? '🎁' : ico === 'Briefcase' ? '💼' : ico === 'Heart' ? '❤️' : ico === 'Smile' ? '😊' : ico === 'Activity' ? '🏥' : '✨' }}
            </button>
          </div>
        </div>
        
        <div class="add-main-actions">
          <button class="btn-jelly btn-cancel-cat" @click="showAddCatForm = false">
            取消 🐾
          </button>
          <button 
            class="btn-jelly btn-save-cat"
            :disabled="!newCatName.trim()" 
            @click="handleAddMainCategory"
          >
            新增主分類 🐾
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 16px;
  padding-bottom: 90px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-muted);
}

/* 設定卡片盒 */
.settings-box {
  padding: 16px !important;
  background-color: #FFFFFF;
  margin-bottom: 20px;
}

.box-title {
  font-size: 17px;
  font-weight: 800;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
}

.form-group {
  margin-bottom: 14px;
  width: 100%;
}

.label-cute {
  font-size: 14px;
  font-weight: 800;
  display: block;
  margin-bottom: 6px;
  padding-left: 4px;
}

/* 預算輸入 */
.budget-input-row {
  display: flex;
  gap: 10px;
}

.budget-input {
  flex: 1;
}

.btn-save-budget {
  background-color: var(--color-accent-gold) !important;
  font-size: 12px;
}

.save-success-badge {
  font-size: 14px;
  font-weight: 800;
  color: #2C8C67;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.budget-desc-card {
  background-color: var(--color-bg-warm);
  border: 1.5px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 10px;
  margin-top: 14px;
}

.desc-text {
  font-size: 15px;
  font-weight: 800;
}

.desc-bold {
  color: #FF5A5A;
  font-size: 17px;
}

.desc-hint {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* Firebase 雲端面板 */
.cloud-status-badge {
  padding: 10px 14px !important;
  margin-bottom: 16px !important;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cloud-active {
  background-color: rgba(46, 176, 134, 0.15) !important;
}

.cloud-inactive {
  background-color: var(--color-bg-warm) !important;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 14px;
  font-weight: 800;
}

.icon-cloud {
  color: var(--color-text-dark);
}

.status-indicator {
  width: 100px;
}

/* 已連線雲端 */
.shield-success-card {
  background-color: #E1F8EB !important;
  text-align: center;
  padding: 20px !important;
}

.icon-shield {
  color: #2EB086;
  margin-bottom: 8px;
}

.shield-desc {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin-top: 6px;
}

.btn-disconnect {
  width: 100%;
  background-color: #FFFFFF !important;
  color: #FF5A5A !important;
  font-size: 12px;
  margin-top: 12px;
}

/* 未連線雲端 */
.btn-connect-cloud {
  width: 100%;
  background-color: var(--color-transfer) !important;
  font-size: 13px;
  margin-top: 12px;
}

.inner-config-card {
  background-color: var(--color-bg-warm) !important;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px !important;
  margin-bottom: 12px !important;
  border-radius: var(--border-radius-md) !important;
  text-align: left;
}

.config-icon {
  font-size: 24px;
}

.config-details {
  flex: 1;
}

.config-title {
  font-size: 15px !important;
  font-weight: 800 !important;
  margin-bottom: 2px !important;
}

.config-sub {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.config-code {
  background-color: rgba(44, 30, 27, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: monospace;
}

.config-sub-hint {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* 🐾 分類管理大師樣式 */
.categories-preview-hint {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: 12px;
}

.category-tabs-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.btn-cat-tab {
  flex: 1;
  font-size: 12px;
  background-color: var(--color-bg-warm) !important;
}

.btn-cat-tab.active {
  background-color: var(--color-accent-gold) !important;
  border-color: var(--color-border) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  transform: translateY(-1px);
}

.cat-accordion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.cat-accordion-item {
  padding: 12px !important;
  margin-bottom: 0 !important;
  background-color: #FFFFFF;
}

.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cat-icon-emoji {
  font-size: 16px;
}

.cat-name-bold {
  font-size: 15px;
  font-weight: 800;
}

.sub-count-tag {
  font-size: 13px !important;
  padding: 2px 8px !important;
  background-color: var(--color-bg-warm) !important;
  box-shadow: var(--shadow-jelly-sm-sm, 1px 1px 0 0 #2C1E1B) !important;
}

.btn-delete-cat {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-sm);
  transition: background-color 0.15s ease;
}

.btn-delete-cat:hover {
  background-color: #FFDADA;
}

.btn-delete-cat :deep(svg) {
  stroke: #FF5A5A;
}

.accordion-body {
  border-top: 1.5px dashed var(--color-border);
  margin-top: 10px;
  padding-top: 12px;
  text-align: left;
}

.sub-pills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.sub-cute-pill {
  background-color: #FFFFFF !important;
  font-size: 13px !important;
  padding: 4px 8px 4px 10px !important;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: var(--shadow-jelly-sm-sm, 1px 1px 0 0 #2C1E1B) !important;
}

.btn-remove-sub {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 50%;
}

.btn-remove-sub:hover {
  background-color: var(--color-bg-warm);
}

.btn-remove-sub :deep(svg) {
  stroke: #FF5A5A;
}

.empty-sub-hint {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-align: center;
  margin-bottom: 12px;
}

.add-sub-row {
  display: flex;
  gap: 8px;
}

.input-sub-cute {
  font-size: 14px !important;
  padding: 6px 10px !important;
  flex: 1;
}

.btn-add-sub {
  padding: 6px 10px !important;
  font-size: 14px !important;
  background-color: var(--color-income) !important;
}

.btn-add-main-trigger {
  width: 100%;
  background-color: var(--color-accent-gold) !important;
  font-size: 14px;
}

/* 新增主分類表單 */
.add-main-cat-form {
  padding: 14px !important;
  margin-bottom: 0 !important;
  text-align: left;
}

.add-main-cat-form h4 {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 10px;
}

.margin-top-sm {
  margin-top: 10px;
}

.icon-selector-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.btn-icon-select {
  padding: 6px !important;
  font-size: 14px !important;
  background-color: #FFFFFF !important;
  min-width: unset !important;
}

.btn-icon-select.active {
  background-color: var(--color-accent-gold) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  transform: translateY(-1px);
}

.add-main-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.btn-cancel-cat {
  flex: 1;
  font-size: 12px;
  background-color: #FFFFFF !important;
}

.btn-save-cat {
  flex: 1;
  font-size: 12px;
  background-color: var(--color-income) !important;
}

.btn-save-cat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 過渡動畫 */
.fade-success-enter-active,
.fade-success-leave-active {
  transition: opacity 0.3s ease;
}
.fade-success-enter-from,
.fade-success-leave-to {
  opacity: 0;
}

/* 🔒 Dodo Gatekeeper 鎖定設定區塊與 Modal 樣式 */
.lock-status-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px !important;
  background-color: var(--color-bg-warm) !important;
  margin-bottom: 16px !important;
  text-align: left;
}

.lock-active-border {
  background-color: rgba(46, 176, 134, 0.08) !important;
  border-color: #2EB086 !important;
}

.status-left-lock {
  display: flex;
  align-items: flex-start;
}

.status-info {
  margin-left: 10px;
}

.status-title-text {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 2px;
}

.status-desc-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.lock-actions-row {
  width: 100%;
}

.global-lock-notice {
  background-color: #F0F4F8;
  border: 1.5px solid var(--color-border);
  color: #556B83;
  padding: 10px;
  border-radius: var(--border-radius-md);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.local-actions-flex {
  display: flex;
  gap: 8px;
  width: 100%;
  flex-wrap: wrap;
}

.local-actions-flex button {
  flex: 1;
  min-width: 100px;
  font-size: 12px;
}

.btn-lock-primary {
  background-color: var(--color-accent-gold) !important;
}

.btn-lock-secondary {
  background-color: #FFFFFF !important;
}

.btn-lock-danger {
  background-color: #FFF0ED !important;
  color: #FF5A5A !important;
}

.btn-lock-test {
  background-color: #EEF8F3 !important;
  color: #2EB086 !important;
}

/* Modal Overlay */
.lock-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(44, 30, 27, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lock-modal-card {
  width: 100%;
  max-width: 360px;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-large);
  padding: 20px;
  box-shadow: var(--shadow-jelly-lg);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: var(--border-width) dashed var(--color-border);
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.modal-header h4 {
  font-size: 16px;
  font-weight: 800;
  margin: 0;
}

.btn-close-modal {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
}

.btn-close-modal:hover {
  background-color: var(--color-bg-warm);
}

.modal-body {
  text-align: left;
}

.modal-body-tip {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: 14px;
}

.text-center {
  text-align: center;
  letter-spacing: 4px;
  font-size: 18px;
  font-weight: 800;
}

.modal-error-msg {
  background-color: #FFF0ED;
  color: #FF5A5A;
  border: 1.5px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  padding: 8px;
  font-size: 12px;
  font-weight: 800;
  margin-top: 10px;
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}
</style>

