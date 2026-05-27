<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useLedger } from '../composables/useLedger'
import DodoCat from './DodoCat.vue'
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  LogOut, 
  PlusCircle,
  ArrowLeftRight
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'change-tab', tab: string): void
}>()

const { currentProfile, logout } = useAuth()
const { 
  transactions,
  totalAssets, 
  totalLiabilities, 
  netWorth, 
  monthlyExpense, 
  monthlyIncome,
  budgetRatio,
  dodoCatMood,
  dodoCatSpeech,
  interactWithCat
} = useLedger()

// 切換身分泡泡選單控制
const showUserMenu = ref(false)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const handleLogout = () => {
  showUserMenu.value = false
  logout()
}

// 取得近 3 筆交易紀錄
const recentTransactions = computed(() => {
  // 對交易時間排序
  return [...transactions.value]
    .sort((a, b) => b.date - a.date)
    .slice(0, 3)
})

// 格式化千分位金額
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
}

// 根據交易類型取得可愛的金額樣式
const getTxAmountStyle = (tx: any) => {
  if (tx.type === 'expense') return { color: '#FF7B7B', prefix: '-' }
  if (tx.type === 'income') return { color: '#2EB086', prefix: '+' }
  return { color: '#3A86C8', prefix: '' }
}
</script>

<template>
  <div class="dashboard-container">
    <!-- 頂部 Header & 身分切換 -->
    <div class="dashboard-header">
      <div class="user-profile-widget">
        <div class="avatar-badge btn-jelly" @click="toggleUserMenu">
          <span class="avatar-emoji">{{ currentProfile?.avatar }}</span>
          <span class="user-name">{{ currentProfile?.name }}</span>
        </div>
        
        <!-- 身分切換/登出可愛下拉選單 -->
        <Transition name="fade-menu">
          <div v-if="showUserMenu" class="user-dropdown-menu card-jelly pop-jelly">
            <button class="menu-item btn-jelly" @click="handleLogout">
              <LogOut :size="14" class="menu-icon" /> 登出/切換身分
            </button>
          </div>
        </Transition>
      </div>

      <div class="app-logo-cute">
        <span class="logo-emoji">🐱</span> Dodo Ledger
      </div>
    </div>

    <!-- 1. 🐱 逗逗貓療癒生活看板 (最上方 30-40% 畫面高) -->
    <div class="mascot-board card-jelly">
      <DodoCat :mood="dodoCatMood" :speech="dodoCatSpeech" @pet="interactWithCat('pet')" />
      
      <!-- 🐾 逗逗貓趣味互動餵食箱 -->
      <div class="cat-interaction-bar pop-jelly">
        <button class="btn-interact btn-jelly" @click="interactWithCat('feed_fish')">
          🐟 餵魚乾
        </button>
        <button class="btn-interact btn-jelly" @click="interactWithCat('feed_can')">
          🥫 餵罐罐
        </button>
      </div>
    </div>

    <!-- 2. 🧮 淨資產與收支看板 -->
    <div class="networth-card card-jelly">
      <div class="networth-label">
        <Wallet :size="16" class="icon-net" /> 淨資產淨值
      </div>
      <div class="networth-amount" :class="{ 'negative-wealth': netWorth < 0 }">
        TWD ${{ formatCurrency(netWorth) }}
      </div>
      <div class="assets-debts-grid">
        <div class="grid-sub-item">
          <span class="sub-label">總資產 (正值)</span>
          <span class="sub-amount asset-green">${{ formatCurrency(totalAssets) }}</span>
        </div>
        <div class="grid-sub-item">
          <span class="sub-label">總負債 (卡費等)</span>
          <span class="sub-amount liability-orange">${{ formatCurrency(totalLiabilities) }}</span>
        </div>
      </div>
    </div>

    <!-- 3. 📊 本月收支與預算進度條 -->
    <div class="budget-analytics card-jelly">
      <h3 class="card-inner-title">本月收支概覽</h3>
      <div class="income-expense-row">
        <div class="cash-flow-box income-box">
          <div class="flow-header">
            <TrendingUp :size="14" stroke-width="3" class="flow-icon icon-inc" />
            <span>本月總收入</span>
          </div>
          <p class="flow-amount">${{ formatCurrency(monthlyIncome) }}</p>
        </div>
        <div class="cash-flow-box expense-box">
          <div class="flow-header">
            <TrendingDown :size="14" stroke-width="3" class="flow-icon icon-exp" />
            <span>本月總支出</span>
          </div>
          <p class="flow-amount">${{ formatCurrency(monthlyExpense) }}</p>
        </div>
      </div>

      <!-- 預算進度條 -->
      <div class="budget-progress-section">
        <div class="progress-labels">
          <span class="progress-title">月度預算使用進度</span>
          <span class="progress-ratio-text">
            {{ Math.round(budgetRatio * 100) }}% 
            ({{ formatCurrency(monthlyExpense) }} / {{ formatCurrency(currentProfile?.settings.monthlyBudget || 20000) }})
          </span>
        </div>
        <div class="progress-bar-container">
          <div 
            class="progress-bar-fill" 
            :style="{ 
              width: `${Math.min(budgetRatio * 100, 100)}%`,
              backgroundColor: budgetRatio >= 1.0 ? '#FF7B7B' : budgetRatio >= 0.8 ? '#FFC77B' : '#B5EAD7'
            }"
          ></div>
        </div>
        <p v-if="budgetRatio >= 1.0" class="budget-alert-text pop-jelly">⚠️ 喵！主人，您這個月花超支啦！要克制喔！</p>
      </div>
    </div>

    <!-- 4. 📝 近期交易紀錄 (近 3 筆) -->
    <div class="recent-transactions-section card-jelly">
      <div class="section-header">
        <h3 class="card-inner-title">近期收支明細</h3>
        <button class="btn-jelly btn-view-all" @click="emit('change-tab', 'transactions')">
          查看全部
        </button>
      </div>

      <div v-if="recentTransactions.length === 0" class="empty-tx-placeholder">
        <p class="empty-text">目前還沒有記帳明細喔～🐾</p>
        <button class="btn-jelly btn-go-add" @click="emit('change-tab', 'add')">
          <PlusCircle :size="14" class="menu-icon" /> 讓逗逗貓幫您記第一筆！
        </button>
      </div>

      <div v-else class="tx-list-cute">
        <div 
          v-for="tx in recentTransactions" 
          :key="tx.id"
          class="tx-item-cute card-jelly"
        >
          <!-- 交易主子分類與 icon -->
          <div class="tx-left-side">
            <div 
              class="tx-icon-circle"
              :style="{ 
                backgroundColor: tx.type === 'expense' ? '#FFDADA' : tx.type === 'income' ? '#E1F8EB' : '#E3EFFF'
              }"
            >
              <ArrowLeftRight v-if="tx.type === 'transfer'" :size="16" />
              <span v-else class="tx-type-dot">{{ tx.type === 'expense' ? '💸' : '💰' }}</span>
            </div>
            <div class="tx-info-block">
              <span class="tx-category-tag">
                {{ tx.category }}{{ tx.subCategory ? ` ➜ ${tx.subCategory}` : '' }}
              </span>
              <div class="tx-note-row">
                <span class="tx-note">{{ tx.note || '無備註' }}</span>
                <span v-if="tx.createdBy" class="tag-jelly tx-creator-badge">
                  ✍️ {{ tx.createdByAvatar }} {{ tx.createdBy }}
                </span>
              </div>
            </div>
          </div>

          <!-- 交易金額與日期 -->
          <div class="tx-right-side">
            <span 
              class="tx-amount-text"
              :style="{ color: getTxAmountStyle(tx).color }"
            >
              {{ getTxAmountStyle(tx).prefix }}${{ formatCurrency(tx.amount) }}
            </span>
            <span class="tx-date-small">
              {{ new Date(tx.date).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'}) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 16px;
  padding-bottom: 90px; /* 預留底欄高度 */
}

/* 頂部 Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  position: relative;
  z-index: 100;
}

.user-profile-widget {
  position: relative;
}

.avatar-badge {
  padding: 6px 12px !important;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #FFFFFF;
}

.avatar-emoji {
  font-size: 20px;
}

.user-name {
  font-size: 13px;
  font-weight: 800;
}

.user-dropdown-menu {
  position: absolute;
  top: 48px;
  left: 0;
  z-index: 110;
  width: 170px;
  padding: 10px !important;
  background-color: #FFFFFF;
  margin-bottom: 0;
}

.menu-item {
  width: 100% !important;
  padding: 8px !important;
  font-size: 12px;
  justify-content: flex-start;
  gap: 6px;
  background-color: var(--color-bg-warm) !important;
}

.menu-icon {
  color: var(--color-text-muted);
}

.app-logo-cute {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.logo-emoji {
  font-size: 18px;
}

/* 逗逗貓生活看板區 */
.mascot-board {
  padding: 12px !important;
  background-color: var(--color-card-bg);
  overflow: visible; /* 移除 hidden，防止氣泡被截斷 */
  height: 240px; /* 增加高度，給氣泡充足的顯示空間 */
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative; /* 方便內部互動按鈕定位 */
}

/* 🐾 逗逗貓趣味互動工具列 */
.cat-interaction-bar {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 30;
}

.btn-interact {
  padding: 5px 10px !important;
  font-size: 13px !important;
  background-color: var(--color-bg-warm) !important;
  border-radius: var(--border-radius-sm) !important;
  box-shadow: 1.5px 1.5px 0px 0px #2C1E1B !important;
  font-weight: 800 !important;
}

.btn-interact:hover {
  transform: translateY(-1px) !important;
  box-shadow: 2px 2px 0px 0px #2C1E1B !important;
}

.btn-interact:active {
  transform: translateY(1px) !important;
  box-shadow: 1px 1px 0px 0px #2C1E1B !important;
}

/* 淨資產卡片 */
.networth-card {
  background-color: var(--color-accent-gold) !important;
  text-align: center;
}

.networth-label {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.icon-net {
  color: var(--color-text-muted);
}

.networth-amount {
  font-size: 30px;
  font-weight: 800;
  margin: 10px 0;
  letter-spacing: -0.5px;
}

.negative-wealth {
  color: #FF5A5A !important;
}

.assets-debts-grid {
  display: flex;
  border-top: 1.5px dashed var(--color-border);
  margin-top: 10px;
  padding-top: 10px;
}

.grid-sub-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.grid-sub-item:first-child {
  border-right: 1.5px dashed var(--color-border);
}

.sub-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.sub-amount {
  font-size: 16px;
  font-weight: 800;
  margin-top: 2px;
}

.asset-green { color: #2C8C67; }
.liability-orange { color: #C66230; }

/* 本月收支與預算 */
.card-inner-title {
  font-size: 17px;
  font-weight: 800;
  margin-bottom: 12px;
}

.income-expense-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.cash-flow-box {
  flex: 1;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 10px;
  box-shadow: var(--shadow-jelly-sm);
}

.income-box { background-color: var(--color-income); }
.expense-box { background-color: var(--color-expense); }

.flow-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-dark);
}

.flow-icon {
  stroke-width: 3.5px;
}

.flow-amount {
  font-size: 19px;
  font-weight: 800;
  margin-top: 4px;
}

/* 預算進度條 */
.budget-progress-section {
  border-top: 1.5px dashed var(--color-border);
  padding-top: 14px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 6px;
}

.progress-ratio-text {
  color: var(--color-text-muted);
}

.budget-alert-text {
  font-size: 15px;
  font-weight: 800;
  color: #FF5A5A;
  margin-top: 6px;
  text-align: center;
}

/* 近期交易紀錄 */
.recent-transactions-section {
  padding-bottom: 10px !important;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.btn-view-all {
  padding: 4px 10px !important;
  font-size: 14px;
  background-color: var(--color-bg-warm) !important;
}

.empty-tx-placeholder {
  text-align: center;
  padding: 24px 0;
}

.empty-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.btn-go-add {
  font-size: 12px;
  background-color: var(--color-accent-gold) !important;
  gap: 6px;
}

.tx-list-cute {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tx-item-cute {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px !important;
  margin-bottom: 0 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.tx-left-side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tx-icon-circle {
  width: 32px;
  height: 32px;
  border: 1.5px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.tx-info-block {
  display: flex;
  flex-direction: column;
}

.tx-category-tag {
  font-size: 14px;
  font-weight: 800;
}

.tx-note {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.tx-right-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.tx-amount-text {
  font-size: 17px;
  font-weight: 800;
}

.tx-date-small {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* 下拉選單過渡動畫 */
.fade-menu-enter-active,
.fade-menu-leave-active {
  transition: all 0.2s ease;
}
.fade-menu-enter-from,
.fade-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.tx-note-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.tx-creator-badge {
  font-size: 13px !important;
  font-weight: 800;
  color: var(--color-text-muted);
  background-color: var(--color-bg-warm);
  padding: 1px 6px !important;
  border-radius: 10px;
  line-height: 1.4;
}
</style>
