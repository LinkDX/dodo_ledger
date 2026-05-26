<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useLedger } from '../composables/useLedger'
import { getDatabaseService, switchDatabaseService, FirestoreDatabaseService } from '../services/db'
import { 
  Settings as SettingsIcon, 
  Sparkles, 
  CloudLightning,
  Cloud,
  CheckCircle,
  ShieldCheck,
  BadgeAlert
} from 'lucide-vue-next'

const { currentProfile, updateProfileSettings } = useAuth()
const { loadLedgerData } = useLedger()

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

// 2. Firebase 雲端同步設定狀態
const firebaseApiKey = ref('')
const firebaseProjectId = ref('')
const firebaseAuthDomain = ref('')
const isCloudConnected = ref(false)

// 檢查目前是否為 Firebase 連線狀態
const isCurrentlyCloudMode = ref(getDatabaseService() instanceof FirestoreDatabaseService)

const handleConnectCloud = async () => {
  if (!firebaseApiKey.value.trim() || !firebaseProjectId.value.trim()) return

  // 1. 模擬/建立一個真實的 Firebase 雲端服務層實例
  const cloudConfig = {
    apiKey: firebaseApiKey.value.trim(),
    authDomain: firebaseAuthDomain.value.trim(),
    projectId: firebaseProjectId.value.trim()
  }

  const cloudService = new FirestoreDatabaseService(cloudConfig)
  
  // 2. 切換全域的 active service 到雲端服務層
  switchDatabaseService(cloudService)
  
  // 3. 觸發資料重載與同步
  if (currentProfile.value) {
    await loadLedgerData()
  }

  isCloudConnected.value = true
  isCurrentlyCloudMode.value = true
  alert('🐱 喵！成功連接 Firebase 雲端資料庫！資料已同步備份上雲囉！')
}

// 斷開雲端，切回本地
const handleDisconnectCloud = async () => {
  // 切回預設的本地 Mock 服務
  const { switchDatabaseService, MockDatabaseService } = await import('../services/db')
  switchDatabaseService(new MockDatabaseService())
  
  if (currentProfile.value) {
    await loadLedgerData()
  }

  isCurrentlyCloudMode.value = false
  isCloudConnected.value = false
  firebaseApiKey.value = ''
  firebaseProjectId.value = ''
  firebaseAuthDomain.value = ''
  alert('🐱 喵嗚！已中斷 Firebase 雲端連線，資料切回 LocalStorage 本地儲存模式。')
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

    <!-- 2. Firebase 雲端同步綁定 (雙模式無縫切換核心) -->
    <div class="settings-box card-jelly">
      <h3 class="box-title">
        <CloudLightning class="icon-inline" /> Firebase 雲端同步控制台
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
        <div class="status-indicator"></div>
      </div>

      <!-- 2.1 目前已連接 Firebase 狀態 -->
      <div v-if="isCurrentlyCloudMode" class="cloud-connected-info pop-jelly">
        <div class="shield-success-card card-jelly">
          <ShieldCheck :size="32" class="icon-shield" />
          <h4>雲端防護已啟動！</h4>
          <p class="shield-desc">
            您的記帳資料目前正在 Firebase 雲端安全備份保護中。<br>
            未來的 **Android App** 將能無縫載入此雲端帳本，共同記帳留名紀錄！
          </p>
        </div>
        <button class="btn-jelly btn-disconnect" @click="handleDisconnectCloud">
          斷開 Firebase 雲端，切回本地 🔌
        </button>
      </div>

      <!-- 2.2 未連接狀態：顯示輸入欄位 -->
      <div v-else class="cloud-form pop-jelly">
        <p class="cloud-form-hint">
          🐱 逗逗貓小教學：只要在下方填入您的 Firebase 網頁端 Web 配置，逗逗貓就能立刻幫您建立跨裝置備份雲，並保留未來 Android App 讀取的物理通道喵！
        </p>

        <div class="form-group">
          <label class="label-cute">Firebase API Key</label>
          <input 
            v-model="firebaseApiKey" 
            type="password" 
            placeholder="AIzaSyA1..." 
            class="input-jelly" 
          />
        </div>

        <div class="form-group">
          <label class="label-cute">Firebase Project ID</label>
          <input 
            v-model="firebaseProjectId" 
            type="text" 
            placeholder="dodo-ledger-abcde" 
            class="input-jelly" 
          />
        </div>

        <div class="form-group">
          <label class="label-cute">Firebase Auth Domain (可選)</label>
          <input 
            v-model="firebaseAuthDomain" 
            type="text" 
            placeholder="dodo-ledger.firebaseapp.com" 
            class="input-jelly" 
          />
        </div>

        <button 
          class="btn-jelly btn-connect-cloud"
          :disabled="!firebaseApiKey.trim() || !firebaseProjectId.trim()"
          @click="handleConnectCloud"
        >
          測試連線並一鍵同步上雲 🚀
        </button>
      </div>
    </div>

    <!-- 3. 自訂分類與貓咪資訊 -->
    <div class="settings-box card-jelly">
      <h3 class="box-title"><BadgeAlert :size="16" class="icon-inline" /> 記帳分類清單預覽</h3>
      <p class="categories-preview-hint">
        本月共有 {{ currentProfile?.settings.categories.length }} 個預設雙層生活化主分類。您新增的所有交易皆會歸類於此。
      </p>
      
      <div class="categories-pills-list">
        <span 
          v-for="cat in currentProfile?.settings.categories" 
          :key="cat.id"
          class="tag-jelly cat-preview-pill"
          :style="{ backgroundColor: cat.type === 'expense' ? '#FFDADA' : '#E1F8EB' }"
        >
          {{ cat.type === 'expense' ? '🔴' : '🟢' }} {{ cat.name }} ({{ cat.subCategories.length }} 子類)
        </span>
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
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 11px;
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
  font-size: 15px;
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
  font-size: 12px;
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
  font-size: 10px;
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
  font-size: 13px;
  font-weight: 800;
}

.desc-bold {
  color: #FF5A5A;
  font-size: 15px;
}

.desc-hint {
  font-size: 9px;
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
  font-size: 12px;
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
  font-size: 11px;
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
.cloud-form-hint {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-bottom: 14px;
  background-color: var(--color-bg-warm);
  border: 1.5px solid var(--color-border);
  padding: 8px;
  border-radius: var(--border-radius-md);
}

.btn-connect-cloud {
  width: 100%;
  background-color: var(--color-transfer) !important;
  font-size: 13px;
  margin-top: 12px;
}

.btn-connect-cloud:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

/* 分類預覽 */
.categories-preview-hint {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: 12px;
}

.categories-pills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cat-preview-pill {
  font-size: 10px !important;
  font-weight: 800 !important;
  padding: 3px 8px !important;
  box-shadow: var(--shadow-jelly-sm-sm) !important;
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
</style>
