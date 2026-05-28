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
  ArrowLeftRight,
  Award
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'change-tab', tab: string): void
}>()

const { currentProfile, logout } = useAuth()
const { 
  transactions,
  accounts,
  totalAssets, 
  totalLiabilities, 
  netWorth, 
  monthlyExpense, 
  monthlyIncome,
  budgetRatio,
  dodoCatMood,
  dodoCatSpeech,
  catProfile,
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

const openAchievements = () => {
  showUserMenu.value = false
  showAchievements.value = true
}

// 取得帳戶名稱
const getAccountName = (id?: string) => {
  if (!id) return ''
  return accounts.value.find(a => a.id === id)?.name || ''
}

// 取得近 3 筆交易紀錄
const recentTransactions = computed(() => {
  const floorDay = (ts: number) => {
    const d = new Date(ts)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  return [...transactions.value]
    .sort((a, b) => {
      const diff = floorDay(b.date) - floorDay(a.date)
      return diff !== 0 ? diff : (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    })
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

// 🏆 成就徽章牆控制與定義
const showAchievements = ref(false)

const achievementList = [
  // 摸摸大師系列 (檢討後門檻提升，以配合無 CD 機制)
  { id: 'pet_100', title: '初級鏟屎官', desc: '累計摸摸逗逗貓 100 次。', emoji: '👋' },
  { id: 'pet_500', title: '得心應手', desc: '累計摸摸逗逗貓 500 次。', emoji: '💆' },
  { id: 'pet_2000', title: '貓咪按摩師', desc: '累計摸摸逗逗貓 2000 次。', emoji: '🖐️' },
  { id: 'pet_10000', title: '皇家擼貓聖手', desc: '累計摸摸逗逗貓 10000 次。', emoji: '👑' },

  // 米其林飼養員系列 (檢討後門檻提升，以配合無 CD 機制)
  { id: 'feed_50', title: '見習飼養員', desc: '累計餵食（魚乾或罐罐） 50 次。', emoji: '🐟' },
  { id: 'feed_200', title: '特級主廚', desc: '累計餵食（魚乾或罐罐） 200 次。', emoji: '🧑‍🍳' },
  { id: 'feed_1000', title: '皇家御膳房總管', desc: '累計餵食（魚乾或罐罐） 1000 次。', emoji: '🍣' },

  // 長情陪伴系列
  { id: 'streak_3', title: '三日溫存', desc: '連續 3 天開啟 App 並與逗逗貓互動。', emoji: '🌱' },
  { id: 'streak_7', title: '全職貓奴', desc: '連續 7 天開啟 App 並與逗逗貓互動。', emoji: '📅' },
  { id: 'streak_30', title: '終身伴侶', desc: '連續 30 天開啟 App 並與逗逗貓互動。', emoji: '💖' },

  // 健康理財系列
  { id: 'wealth_100k', title: '金庫滿盈', desc: '個人總資產首次突破或達到 TWD $100,000 大關！', emoji: '💎' },
  { id: 'saving_master', title: '存錢大師', desc: '當月記帳「收入」大於「支出」的兩倍。', emoji: '💰' },
  { id: 'zero_debt', title: '無債一身輕', desc: '個人淨資產為正值，且所有信用卡負債皆已全數清空！', emoji: '🕊️' },
  { id: 'saver_10', title: '省錢達人', desc: '當月總支出低於理財預算的 10%（需已設定月預算且當月有記帳支出）。', emoji: '🛡️' },
  { id: 'debt_buster', title: '負債剋星', desc: '單筆還清信用卡款項超過 TWD $10,000。', emoji: '💥' },

  // 隱藏彩蛋
  { id: 'cat_vault', title: '貓咪保險箱', desc: '成功建立並啟用至少一個「週期性自動記帳」設定項目。', emoji: '🔐', isHidden: true },
  { id: 'disturbed_sleep', title: '擾人清夢', desc: '在凌晨 02:00 ~ 05:00 之間，點擊睡覺中的貓咪 20 次。', emoji: '⏰', isHidden: true },
  { id: 'cold_war', title: '冷戰期', desc: '超過 7 天未開啟 App 後重新回來陪伴。', emoji: '❄️', isHidden: true },
  { id: 'combo_50', title: '幻影無影手', desc: '在 10 秒內連續摸摸逗逗貓 50 次！⚡', emoji: '⚡', isHidden: true }
]

const isAchievementUnlocked = (id: string) => {
  if (!catProfile.value || !catProfile.value.unlockedAchievementIds) return false
  return catProfile.value.unlockedAchievementIds.includes(id)
}
</script>

<template>
  <div class="dashboard-container">
    <!-- 頂部 Header & 身分切換 -->
    <div class="dashboard-header">
      <div class="header-left-actions">
        <div class="user-profile-widget">
          <div class="avatar-badge btn-jelly" @click="toggleUserMenu">
            <span class="avatar-emoji">{{ currentProfile?.avatar }}</span>
            <span class="user-name">{{ currentProfile?.name }}</span>
          </div>
          
          <!-- 身分切換/登出可愛下拉選單 -->
          <Transition name="fade-menu">
            <div v-if="showUserMenu" class="user-dropdown-menu card-jelly pop-jelly">
              <button class="menu-item btn-jelly" @click="handleLogout">
                <LogOut :size="14" class="menu-icon" /> 🚪 登出/切換身分
              </button>
            </div>
          </Transition>
        </div>

        <button class="btn-jelly btn-header-action btn-achievement" @click="openAchievements">
          <Award :size="14" class="menu-icon" /> 成就
        </button>
      </div>

      <div class="app-logo-cute">
        <span class="logo-emoji">🐱</span> Dodo Ledger
      </div>
    </div>

    <!-- 1. 🐱 逗逗貓療癒生活看板 (最上方 30-40% 畫面高) -->
    <div class="mascot-board card-jelly">
      <!-- 貓咪陪伴狀態列 (拿掉精力與等級，改為溫馨相伴指標) -->
      <div v-if="catProfile" class="cat-status-overlay pop-jelly">
        <div class="status-bars" style="min-width: 100px; gap: 4px;">
          <div class="companion-stat-item" style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800;">
            <span class="companion-label" style="color: var(--color-text-muted);">相伴天數</span>
            <span class="companion-value" style="color: var(--color-expense); background: rgba(0,0,0,0.05); padding: 0 4px; border-radius: 4px;">{{ catProfile.stats.streakDays }} 天</span>
          </div>
          <div class="companion-stat-item" style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800;">
            <span class="companion-label" style="color: var(--color-text-muted);">親密互動</span>
            <span class="companion-value" style="color: var(--color-income); background: rgba(0,0,0,0.05); padding: 0 4px; border-radius: 4px;">{{ catProfile.stats.totalPets + catProfile.stats.totalFeeds }} 次</span>
          </div>
        </div>
      </div>

      <DodoCat :mood="dodoCatMood" :speech="dodoCatSpeech" @pet="interactWithCat('pet')" />
      
      <!-- 🐾 逗逗貓趣味互動餵食箱 (拿掉精力消耗，自由餵食) -->
      <div class="cat-interaction-bar pop-jelly">
        <button 
          class="btn-interact btn-jelly" 
          @click="interactWithCat('feed_fish')"
        >
          🐟 餵小魚乾
        </button>
        <button 
          class="btn-interact btn-jelly" 
          @click="interactWithCat('feed_can')"
        >
          🥫 餵好罐罐
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
              </div>
              <div class="tx-details-row">
                <span class="tx-account-info">
                  <template v-if="tx.type === 'transfer'">
                    {{ getAccountName(tx.fromAccountId) }} → {{ getAccountName(tx.toAccountId) }}
                  </template>
                  <template v-else-if="tx.fromAccountId">
                    {{ getAccountName(tx.fromAccountId) }}
                  </template>
                  <template v-else-if="tx.toAccountId">
                    {{ getAccountName(tx.toAccountId) }}
                  </template>
                </span>
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

    <!-- 🏆 成就徽章彈出面板 -->
    <Transition name="fade-modal">
      <div v-if="showAchievements" class="modal-overlay" @click.self="showAchievements = false">
        <div class="achievement-modal card-jelly">
          <div class="modal-header">
            <h3 class="modal-title">🏆 逗逗貓成就徽章牆</h3>
            <button class="btn-close-circle btn-jelly" @click="showAchievements = false">×</button>
          </div>
          
          <div class="achievements-list">
            <div 
              v-for="ach in achievementList" 
              :key="ach.id" 
              class="achievement-item card-jelly"
              :class="{ 
                'ach-locked': !isAchievementUnlocked(ach.id),
                'ach-hidden-locked': ach.isHidden && !isAchievementUnlocked(ach.id)
              }"
            >
              <div class="ach-badge-icon">
                <span class="ach-emoji">{{ isAchievementUnlocked(ach.id) ? ach.emoji : '🔒' }}</span>
              </div>
              <div class="ach-info">
                <div class="ach-name">
                  {{ (ach.isHidden && !isAchievementUnlocked(ach.id)) ? '🐱 隱藏成就' : ach.title }}
                  <span v-if="!isAchievementUnlocked(ach.id)" class="ach-locked-tag">
                    {{ ach.isHidden ? '未探索' : '鎖定中' }}
                  </span>
                  <span v-else class="ach-unlocked-tag">已達成 🎉</span>
                </div>
                <div class="ach-desc">
                  {{ (ach.isHidden && !isAchievementUnlocked(ach.id)) ? '？？？（這是一個神秘的隱藏彩蛋，努力探索吧喵！）' : ach.desc }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
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

.header-left-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.btn-header-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px !important;
  font-size: 13px;
  font-weight: 800;
  background-color: #FFFFFF !important;
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

/* 🐾 貓咪狀態疊加層 */
.cat-status-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 6px 10px;
  border-radius: 12px;
  border: 1.5px solid var(--color-border);
  z-index: 30;
  backdrop-filter: blur(4px);
}

.level-badge {
  background-color: var(--color-accent-gold);
  color: var(--color-text-dark);
  font-weight: 800;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 8px;
  border: 1.5px solid var(--color-border);
}

.status-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 80px;
}

.bar-label {
  font-size: 9px;
  font-weight: 800;
  color: var(--color-text-muted);
  line-height: 1;
  display: flex;
  justify-content: space-between;
}

.bar-track {
  height: 6px;
  background-color: #E0E0E0;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease-out;
}

.energy-fill { background-color: var(--color-income); }
.xp-fill { background-color: #C3B1E1; } /* 薰衣草紫 */

.cost-tag {
  font-size: 10px;
  background-color: rgba(0,0,0,0.1);
  padding: 0px 4px;
  border-radius: 4px;
  margin-left: 2px;
}

.btn-disabled {
  opacity: 0.5;
  filter: grayscale(0.8);
  cursor: not-allowed;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.tx-account-info {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.tx-details-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  margin-top: 1px;
  min-width: 0;
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
  flex-wrap: nowrap;
  margin-top: 2px;
  min-width: 0;
}

.tx-creator-badge {
  font-size: 13px !important;
  font-weight: 800;
  color: var(--color-text-muted);
  background-color: var(--color-bg-warm);
  padding: 1px 6px !important;
  border-radius: 10px;
  line-height: 1.4;
  flex-shrink: 0;
}

/* 🏆 成就按鈕樣式 */
.btn-achievement {
  background-color: #FFF2CC !important;
  color: var(--color-text-dark) !important;
}

.btn-achievement:hover {
  background-color: var(--color-accent-gold) !important;
}

/* 成就彈窗 Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(44, 30, 27, 0.4); /* 手繪風深褐色透明背景 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
  backdrop-filter: blur(4px);
  padding: 20px;
  box-sizing: border-box;
}

/* 成就彈窗本體 */
.achievement-modal {
  background-color: var(--color-bg-warm);
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  padding: 20px !important;
  overflow: visible;
  position: relative;
}

/* 彈窗 Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 2px dashed var(--color-border);
  padding-bottom: 10px;
}

.modal-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-dark);
  margin: 0;
}

.btn-close-circle {
  width: 28px;
  height: 28px;
  border-radius: 50% !important;
  border: var(--border-width) solid var(--color-border) !important;
  background-color: var(--color-expense) !important;
  color: var(--color-text-dark) !important;
  font-size: 18px !important;
  font-weight: 800 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 !important;
  box-shadow: 1.5px 1.5px 0px 0px #2C1E1B !important;
}

.btn-close-circle:active {
  transform: scale(0.9) !important;
}

/* 成就列表滾動區 */
.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
}

/* 成就單個卡片 */
.achievement-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px !important;
  background-color: #FFFFFF !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  transition: all 0.2s ease;
}

/* 鎖定狀態 */
.ach-locked {
  background-color: #F5F5F5 !important;
  opacity: 0.75;
  filter: grayscale(0.9);
}

/* 徽章圖示 */
.ach-badge-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: var(--border-width) solid var(--color-border);
  background-color: var(--color-bg-warm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: 1px 1px 0px 0px #2C1E1B;
}

.achievement-item:not(.ach-locked) .ach-badge-icon {
  background-color: #FFF2CC;
  animation: badgePulse 2s infinite ease-in-out;
}

@keyframes badgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* 成就文字資訊 */
.ach-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.ach-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ach-desc {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* 標籤 */
.ach-unlocked-tag {
  font-size: 10px;
  background-color: var(--color-income);
  color: var(--color-text-dark);
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.ach-locked-tag {
  font-size: 10px;
  background-color: #E0E0E0;
  color: #757575;
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid #BDBDBD;
}

/* 彈窗過渡動畫 */
.fade-modal-enter-active,
.fade-modal-leave-active {
  transition: opacity 0.25s ease;
}

.fade-modal-enter-from,
.fade-modal-leave-to {
  opacity: 0;
}

.fade-modal-enter-active .achievement-modal {
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.fade-modal-leave-active .achievement-modal {
  animation: popOut 0.2s ease-in;
}

@keyframes popIn {
  0% { transform: scale(0.85); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes popOut {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0; }
}
</style>
