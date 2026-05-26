<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from './composables/useAuth'
import UserSelection from './components/UserSelection.vue'
import Dashboard from './components/Dashboard.vue'
import AccountManager from './components/AccountManager.vue'
import CreditCardCenter from './components/CreditCardCenter.vue'
import TransactionForm from './components/TransactionForm.vue'
import Analytics from './components/Analytics.vue'
import Settings from './components/Settings.vue'
import { 
  Home, 
  Wallet, 
  CreditCard, 
  PlusCircle, 
  TrendingUp, 
  Settings as SettingsIcon 
} from 'lucide-vue-next'

const { isLoggedIn } = useAuth()

// 目前選取的 Tab 頁面
const activeTab = ref('dashboard')

const setTab = (tab: string) => {
  activeTab.value = tab
}
</script>

<template>
  <!-- 1. 若未選擇身分登入，呈現超萌身分牆 -->
  <div v-if="!isLoggedIn" class="app-viewport">
    <UserSelection />
  </div>

  <!-- 2. 已登入，呈現記帳服務主介面 -->
  <div v-else class="app-viewport">
    <!-- 主體內容切換區 -->
    <div class="app-main-content">
      <!-- 首頁儀表板 -->
      <div v-show="activeTab === 'dashboard'">
        <Dashboard @change-tab="setTab" />
      </div>

      <!-- 帳戶管理與互轉 -->
      <div v-show="activeTab === 'accounts'">
        <AccountManager />
      </div>

      <!-- 信用卡理財中心 -->
      <div v-show="activeTab === 'credit'">
        <CreditCardCenter />
      </div>

      <!-- 記帳表單 -->
      <div v-show="activeTab === 'add'">
        <TransactionForm />
      </div>

      <!-- 統計分析 -->
      <div v-show="activeTab === 'analytics'">
        <Analytics />
      </div>

      <!-- 設定中心 -->
      <div v-show="activeTab === 'settings'">
        <Settings />
      </div>
    </div>

    <!-- 🌸 可愛巧克力粗框底欄 Tab 導航列 🌸 -->
    <nav class="nav-tab-bar">
      <button 
        class="nav-tab-item btn-tab-reset" 
        :class="{ active: activeTab === 'dashboard' }"
        @click="setTab('dashboard')"
      >
        <Home :size="20" class="tab-icon" />
        <span>首頁</span>
      </button>

      <button 
        class="nav-tab-item btn-tab-reset" 
        :class="{ active: activeTab === 'accounts' }"
        @click="setTab('accounts')"
      >
        <Wallet :size="20" class="tab-icon" />
        <span>資產</span>
      </button>

      <button 
        class="nav-tab-item btn-tab-reset btn-add-center" 
        :class="{ active: activeTab === 'add' }"
        @click="setTab('add')"
      >
        <div class="add-icon-wrapper">
          <PlusCircle :size="32" class="tab-icon-plus" />
        </div>
        <span class="text-add">記帳</span>
      </button>

      <button 
        class="nav-tab-item btn-tab-reset" 
        :class="{ active: activeTab === 'credit' }"
        @click="setTab('credit')"
      >
        <CreditCard :size="20" class="tab-icon" />
        <span>卡片</span>
      </button>

      <button 
        class="nav-tab-item btn-tab-reset" 
        :class="{ active: activeTab === 'analytics' }"
        @click="setTab('analytics')"
      >
        <TrendingUp :size="20" class="tab-icon" />
        <span>統計</span>
      </button>

      <button 
        class="nav-tab-item btn-tab-reset" 
        :class="{ active: activeTab === 'settings' }"
        @click="setTab('settings')"
      >
        <SettingsIcon :size="20" class="tab-icon" />
        <span>設定</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app-viewport {
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  background-color: var(--color-bg-warm);
}

.app-main-content {
  flex: 1;
  width: 100%;
  overflow-y: auto;
}

/* 底欄 Tab 特殊樣式微調 */
.btn-tab-reset {
  background: none;
  border: none;
  outline: none;
  font-family: inherit;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* 記帳 Tab 中心按鈕特別放大放大 */
.btn-add-center {
  position: relative;
}

.add-icon-wrapper {
  margin-top: -20px;
  background-color: var(--color-card-bg);
  border: var(--border-width) solid var(--color-border);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-jelly-sm);
  transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.btn-add-center:active .add-icon-wrapper {
  transform: scale(0.85) translateY(2px);
  box-shadow: var(--shadow-jelly-active);
}

.btn-add-center.active .add-icon-wrapper {
  transform: scale(1.1) translateY(-4px);
  background-color: var(--color-accent-gold);
}

.tab-icon-plus {
  color: var(--color-text-dark);
}

.text-add {
  font-size: 12px;
  font-weight: 800;
  margin-top: 1px;
}

/* Tab 建設中樣式 */
.tab-placeholder {
  padding: 24px;
  min-height: calc(100vh - 72px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-card {
  text-align: center;
  max-width: 320px;
  padding: 28px !important;
  background-color: #FFFFFF;
}

.placeholder-emoji {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
  animation: floatEmoji 3s ease-in-out infinite;
}

@keyframes floatEmoji {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.placeholder-desc {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 12px 0 20px 0;
}

.btn-back {
  background-color: var(--color-accent-gold) !important;
  font-size: 12px;
}
</style>
