<script setup lang="ts">
import { Wallet, Landmark, CreditCard, Compass, Check } from 'lucide-vue-next'
import type { Account } from '../types'

const props = defineProps<{
  modelValue: string    // account id
  accounts: Account[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

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
    <div class="picker-scroll">
      <button
        v-for="acct in accounts"
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
  </div>
</template>

<style scoped>
.account-picker {
  width: 100%;
  max-width: 100%;
  min-width: 0; /* 使用 min-width: 0 阻止 Flexbox 撐寬，同時防止 overflow: hidden 截斷捲軸與卡片陰影 */
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

/* 移除本檔案專屬的自定義滾動條，使其完全繼承 style.css 的全域手繪捲軸，與分類滾動條 100% 一致 */

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

/* 馬卡龍卡片配色類別 (對應 AccountManager 的 cardColors) */
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

.acct-type {
  display: none; /* 隱藏帳戶類型，釋放一行高度 */
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
