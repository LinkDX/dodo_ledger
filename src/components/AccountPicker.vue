<script setup lang="ts">
import { ref, computed } from 'vue'
import { Wallet, Landmark, CreditCard, Compass, Check } from 'lucide-vue-next'
import type { Account } from '../types'

const props = defineProps<{
  modelValue: string    // account id
  accounts: Account[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

// 🔍 搜尋與篩選狀態
const searchQuery = ref('')
const selectedType = ref<string>('all')

const filterTabs = [
  { value: 'all', label: '全部', emoji: '✨' },
  { value: 'cash', label: '現金', emoji: '💵' },
  { value: 'bank', label: '銀行', emoji: '🏦' },
  { value: 'credit_card', label: '信用卡', emoji: '💳' },
  { value: 'electronic_ticket', label: '票證', emoji: '🎫' }
]

const filteredAccounts = computed(() => {
  return props.accounts.filter(acct => {
    // 1. 類型過濾
    const matchType = selectedType.value === 'all' || acct.type === selectedType.value
    // 2. 關鍵字過濾
    const matchSearch = !searchQuery.value || acct.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchType && matchSearch
  })
})

const select = (id: string) => emit('update:modelValue', id)

const formatBalance = (val: number) =>
  new Intl.NumberFormat('zh-TW').format(Math.abs(val))

const balanceLabel = (acct: Account) => {
  if (acct.type === 'credit_card') {
    const avail = Math.max((acct.cardDetails?.creditLimit || 0) - Math.abs(acct.balance), 0)
    return `可用 $${formatBalance(avail)}`
  }
  return `$${formatBalance(acct.balance)}`
}
</script>

<template>
  <div class="account-picker">
    <!-- 可愛又極致便利的微型搜尋與篩選面板 (僅在傳入的帳戶大於 4 個時顯示，以防介面在帳戶少時過度繁複) -->
    <div v-if="accounts.length > 4" class="picker-filter-panel">
      <!-- 1. 可愛手繪風搜尋框 -->
      <div class="search-input-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 搜尋帳戶名稱..."
          class="cute-search-input"
        />
        <button 
          v-if="searchQuery" 
          class="btn-clear-search btn-jelly" 
          @click="searchQuery = ''"
          type="button"
        >
          ✕
        </button>
      </div>

      <!-- 2. 類型微型篩選標籤列 -->
      <div class="filter-tabs-scroll">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          type="button"
          class="filter-tab-btn btn-jelly"
          :class="[
            tab.value === 'all' ? 'tab-all' : 
            tab.value === 'cash' ? 'tab-cash' : 
            tab.value === 'bank' ? 'tab-bank' : 
            tab.value === 'credit_card' ? 'tab-card' : 'tab-ticket',
            { 'is-active': selectedType === tab.value }
          ]"
          @click="selectedType = tab.value"
        >
          <span class="tab-emoji">{{ tab.emoji }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- 卡片橫向滑動清單 -->
    <div v-if="filteredAccounts.length > 0" class="picker-scroll">
      <button
        v-for="acct in filteredAccounts"
        :key="acct.id"
        class="btn-jelly acct-card"
        :class="[acct.color, { 'is-selected': modelValue === acct.id }]"
        @click="select(acct.id)"
      >
        <!-- 帳戶 Avatar -->
        <div class="acct-avatar">
          <span v-if="acct.avatar" class="avatar-emoji">{{ acct.avatar }}</span>
          <template v-else>
            <Wallet v-if="acct.type === 'cash'" :size="18" />
            <Landmark v-else-if="acct.type === 'bank'" :size="18" />
            <CreditCard v-else-if="acct.type === 'credit_card'" :size="18" />
            <Compass v-else :size="18" />
          </template>
        </div>

        <!-- 帳戶資訊 -->
        <div class="acct-info">
          <span class="acct-name">{{ acct.name }}</span>
          <span class="acct-balance">{{ balanceLabel(acct) }}</span>
        </div>

        <!-- 選中勾勾 -->
        <div v-if="modelValue === acct.id" class="selected-check">
          <Check :size="9" stroke-width="4" />
        </div>
      </button>
    </div>

    <!-- 🐾 查無帳戶提示 -->
    <div v-else class="no-accounts-prompt pop-jelly">
      <span class="prompt-emoji">🐱</span>
      <span class="prompt-text">喵～沒有找到符合的帳戶喔...</span>
    </div>
  </div>
</template>

<style scoped>
.account-picker {
  width: 100%;
  max-width: 100%;
  min-width: 0; /* 使用 min-width: 0 阻止 Flexbox 撐寬，同時防止 overflow: hidden 截斷捲軸與卡片陰影 */
}

/* 搜尋與過濾面板樣式 */
.picker-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  padding: 0 4px;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.cute-search-input {
  width: 100%;
  height: 32px;
  padding: 0 32px 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-dark);
  background-color: var(--color-bg-warm);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  box-sizing: border-box;
  outline: none;
  transition: all 0.15s ease;
}

.cute-search-input:focus {
  border-color: var(--color-expense); /* 使用支出粉紅色邊框 */
  box-shadow: 0 0 0 2.5px rgba(255, 180, 180, 0.4);
  transform: translateY(-1px);
}

.btn-clear-search {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  background-color: rgba(0, 0, 0, 0.08);
  border: none;
  border-radius: 50%;
  font-size: 8px;
  font-weight: 800;
  color: var(--color-text-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.btn-clear-search:hover {
  background-color: rgba(0, 0, 0, 0.15);
}

.filter-tabs-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 2px 6px 2px;
  -webkit-overflow-scrolling: touch;
}

.filter-tab-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-dark);
  background-color: #FFFFFF;
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 類型分開使用馬卡龍配色 */
.filter-tab-btn.is-active.tab-all    { background-color: #FFF3B0 !important; border-width: 2px; box-shadow: var(--shadow-jelly-sm); }
.filter-tab-btn.is-active.tab-cash   { background-color: #C7F2E6 !important; border-width: 2px; box-shadow: var(--shadow-jelly-sm); }
.filter-tab-btn.is-active.tab-bank   { background-color: #A9C9FF !important; border-width: 2px; box-shadow: var(--shadow-jelly-sm); }
.filter-tab-btn.is-active.tab-card   { background-color: #FFB4B4 !important; border-width: 2px; box-shadow: var(--shadow-jelly-sm); }
.filter-tab-btn.is-active.tab-ticket { background-color: #E2C6FF !important; border-width: 2px; box-shadow: var(--shadow-jelly-sm); }

.tab-emoji {
  font-size: 11px;
}

.tab-label {
  line-height: 1;
}

/* 🐾 查無帳戶提示 */
.no-accounts-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 8px;
  background-color: rgba(0, 0, 0, 0.02);
  border: 2px dashed var(--color-border);
  border-radius: var(--border-radius-md);
  margin: 6px 4px;
  gap: 4px;
}

.prompt-emoji {
  font-size: 20px;
  animation: promptWiggle 2s ease-in-out infinite;
}

@keyframes promptWiggle {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(8deg); }
}

.prompt-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.picker-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  width: 100%;
  max-width: 100%;
  padding: 6px 4px 10px 4px; /* 增加下方內距，提供空間顯示與全域一致的可愛捲軸 */
  -webkit-overflow-scrolling: touch; /* 優化觸控面板流暢度 */
}

.acct-card {
  flex-shrink: 0;
  min-width: 95px; /* 微調寬度，讓多張卡片可以更緊湊並列 */
  flex-direction: column; /* 回歸直立式 column 佈局，使用者極度喜愛的緊湊柱狀樣式！ */
  gap: 3px; /* 縮小垂直 gap，節省高度 */
  padding: 6px 8px !important; /* 壓縮上下內距 */
  border-radius: var(--border-radius-md) !important;
  background-color: var(--color-bg-warm) !important;
  position: relative;
  align-items: center;
  text-align: center;
  border-width: 2px;
  touch-action: pan-x; /* 解放手勢！允許直接在卡片上水平滑動進行橫向滾動 */
}

.acct-card.is-selected {
  border-width: 3px;
  box-shadow: var(--shadow-jelly) !important;
}

/* 馬卡龍卡片配色類別 */
.acct-card.card-gold   { background-color: #FFDAC1 !important; }
.acct-card.card-pink   { background-color: #FFB4B4 !important; }
.acct-card.card-blue   { background-color: #A9C9FF !important; }
.acct-card.card-purple { background-color: #E2C6FF !important; }
.acct-card.card-mint   { background-color: #C7F2E6 !important; }
.acct-card.card-peach  { background-color: #FFCBA4 !important; }
.acct-card.card-lemon  { background-color: #FFF3B0 !important; }
.acct-card.card-rose   { background-color: #FFADC7 !important; }
.acct-card.card-sky    { background-color: #C1E1FF !important; }
.acct-card.card-lilac  { background-color: #D4BAFF !important; }
.acct-card.card-sage   { background-color: #D6EAC0 !important; }
.acct-card.card-cocoa  { background-color: #E8D5C4 !important; }
.acct-card.card-coral  { background-color: #FFBBA8 !important; }

.acct-avatar {
  width: 26px; /* 縮小頭像尺寸，極大程度壓縮垂直空間 */
  height: 26px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.65);
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-emoji {
  font-size: 13px; /* 縮小頭像 Emoji */
  line-height: 1;
}

.acct-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.acct-name {
  font-size: 12px; /* 放大字體，提高可讀性 */
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.acct-balance {
  font-size: 11px; /* 放大金額字體，讓數字更醒目 */
  font-weight: 800;
}

.selected-check {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 14px; /* 縮小選中勾勾 */
  height: 14px;
  border-radius: 50%;
  background-color: var(--color-income);
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
