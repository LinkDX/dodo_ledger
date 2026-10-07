<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useLedger } from '../composables/useLedger'
import { useCategoryAccountMap } from '../composables/useCategoryAccountMap'
import { useConfirm } from '../composables/useConfirm'
import { useAlert } from '../composables/useAlert'
import { 
  Target, 
  Trash2, 
  Plus, 
  RotateCw, 
  X, 
  ChevronLeft
} from 'lucide-vue-next'
import AccountDropdown from './AccountDropdown.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { currentProfile } = useAuth()
const { accounts, categories, getIconEmoji } = useLedger()
const { 
  rulesList, 
  setRule, 
  removeRule, 
  clearAllRules, 
  extractFromHistory 
} = useCategoryAccountMap()
const { showConfirm } = useConfirm()
const { showAlert } = useAlert()

// ─── 新增規則面板狀態 ───
const isAddingRule = ref(false)
const newRuleCatId = ref('')
const newRuleSubCat = ref('')
const newRuleAccountId = ref('')

const selectedMainCat = computed(() => {
  return categories.value.find(c => c.id === newRuleCatId.value)
})

const openAddPanel = () => {
  if (categories.value.length > 0) {
    newRuleCatId.value = categories.value[0].id
    newRuleSubCat.value = ''
  }
  if (accounts.value.length > 0) {
    newRuleAccountId.value = accounts.value[0].id
  }
  isAddingRule.value = true
}

const handleSaveNewRule = async () => {
  if (!selectedMainCat.value) {
    await showAlert('🐱 請先選擇一個主分類喔！')
    return
  }
  if (!newRuleAccountId.value) {
    await showAlert('🐱 請選擇要對應的帳戶喔！')
    return
  }

  await setRule(
    selectedMainCat.value.name,
    newRuleSubCat.value || undefined,
    newRuleAccountId.value
  )

  isAddingRule.value = false
  await showAlert('✨ 成功儲存分類帳戶對應規則喵！')
}

// ─── 快速更換單筆規則對應帳戶 ───
const handleChangeAccount = async (category: string, subCategory: string | undefined, newAccountId: string) => {
  if (!newAccountId) return
  await setRule(category, subCategory, newAccountId)
}

// ─── 刪除單筆規則 ───
const handleDeleteRule = async (key: string) => {
  const confirmed = await showConfirm(
    `確定要解除「${key}」的預設帳戶對應嗎？`,
    '🗑️ 移除對應規則',
    { okText: '確定解除', cancelText: '取消' }
  )
  if (confirmed) {
    await removeRule(key)
  }
}

// ─── 一鍵從歷史紀錄提煉 ───
const isExtracting = ref(false)
const handleExtractFromHistory = async () => {
  const confirmed = await showConfirm(
    `逗逗貓將會分析「${currentProfile.value?.name || '您'}」過去的所有記帳明細，自動提煉出各分類最新使用的帳戶並建立對應。是否開始分析？`,
    '🔄 從記帳歷史自動提煉',
    { okText: '開始分析 🐾', cancelText: '先不要' }
  )

  if (!confirmed) return

  isExtracting.value = true
  try {
    const totalRules = await extractFromHistory()
    await showAlert(`🎉 分析完成！目前共漸出並整理了 ${totalRules} 組分類帳戶對應規則喵！🐾`)
  } catch (e) {
    console.error('提煉失敗：', e)
    await showAlert('❌ 提煉過程發生錯誤，請稍後再試喵！')
  } finally {
    isExtracting.value = false
  }
}

// ─── 清空所有規則 ───
const handleClearAll = async () => {
  if (rulesList.value.length === 0) return
  const confirmed = await showConfirm(
    `確定要清空「${currentProfile.value?.name || '您'}」的所有分類帳戶對應規則嗎？清空後記帳將恢復預設行為。`,
    '⚠️ 清空所有對應規則',
    { okText: '確定全部清空', cancelText: '取消' }
  )
  if (confirmed) {
    await clearAllRules()
    await showAlert('✨ 已清空所有分類對應規則！')
  }
}

// 取得分類圖示 Emoji
const getCatEmojiByName = (catName: string) => {
  const found = categories.value.find(c => c.name === catName)
  return found ? getIconEmoji(found.icon) : '🏷️'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-page">
      <div v-if="show" class="map-modal-backdrop" @click="emit('close')">
      <div class="map-modal-container card-jelly pop-jelly" @click.stop>
        <!-- 頂部導航列 -->
        <div class="modal-header">
          <button class="btn-jelly btn-back-header" @click="emit('close')" type="button">
            <ChevronLeft :size="20" /> 返回設定
          </button>
          <div class="header-title-box">
            <h2 class="modal-title"><Target :size="20" class="icon-inline" /> 分類預設帳戶綁定</h2>
            <span class="user-pill-badge">
              {{ currentProfile?.avatar }} {{ currentProfile?.name }} 的專屬記憶
            </span>
          </div>
          <button class="btn-jelly btn-close-header" @click="emit('close')" type="button">
            <X :size="20" />
          </button>
        </div>

        <!-- 說明提示橫幅 -->
        <div class="intro-banner card-jelly">
          <div class="intro-icon">🐱💡</div>
          <div class="intro-content">
            <p class="intro-text">
              <strong>智慧自動記憶機制：</strong>
              每當您在日常記帳選取分類並送出時，逗逗貓會自動記住您對應的扣款/收款帳戶。下次選取相同分類時，就會自動切換帳戶！
            </p>
            <p class="intro-subtext">
              * 每個家庭成員（例如您與另一半）皆擁有各自獨立的分類對應記憶，互不干擾。您亦可在本頁隨時手動微調。
            </p>
          </div>
        </div>

        <!-- 動作工具列 -->
        <div class="modal-actions-bar">
          <button 
            class="btn-jelly btn-tool-primary" 
            @click="openAddPanel" 
            :disabled="isAddingRule"
            type="button"
            title="新增自訂對應規則"
          >
            <Plus :size="16" /> 新增綁定
          </button>
          
          <button 
            class="btn-jelly btn-tool-secondary" 
            @click="handleExtractFromHistory" 
            :disabled="isExtracting"
            type="button"
            title="從記帳歷史一鍵學習"
          >
            <RotateCw :size="16" :class="{ 'spin-anim': isExtracting }" /> 
            {{ isExtracting ? '分析中...' : '一鍵學習' }}
          </button>

          <button 
            v-if="rulesList.length > 0"
            class="btn-jelly btn-tool-danger" 
            @click="handleClearAll"
            type="button"
            title="清空所有對應規則"
          >
            <Trash2 :size="16" /> 清空
          </button>
        </div>

        <!-- ➕ 新增規則摺疊面板 -->
        <Transition name="expand-details">
          <div v-if="isAddingRule" class="add-rule-panel card-jelly">
            <div class="add-panel-header">
              <h4 class="add-panel-title">✨ 新增分類與帳戶綁定規則</h4>
              <button class="btn-jelly btn-close-sub" @click="isAddingRule = false" type="button">✕</button>
            </div>

            <div class="add-fields-grid">
              <!-- 選擇主分類 -->
              <div class="add-field-group">
                <label class="field-label">1. 選擇主分類：</label>
                <select v-model="newRuleCatId" class="cute-select">
                  <option v-for="c in categories" :key="c.id" :value="c.id">
                    {{ getIconEmoji(c.icon) }} {{ c.name }} ({{ c.type === 'expense' ? '支出' : '收入' }})
                  </option>
                </select>
              </div>

              <!-- 選擇子分類 (可選) -->
              <div class="add-field-group">
                <label class="field-label">2. 選擇子分類 (選填)：</label>
                <select v-model="newRuleSubCat" class="cute-select">
                  <option value="">✨ 全部分類通用預設 (不限子分類)</option>
                  <option v-for="sub in selectedMainCat?.subCategories || []" :key="sub" :value="sub">
                    👉 {{ sub }}
                  </option>
                </select>
              </div>

              <!-- 選擇對應帳戶 -->
              <div class="add-field-group">
                <label class="field-label">3. 預設自動切換帳戶：</label>
                <AccountDropdown v-model="newRuleAccountId" :accounts="accounts" placeholder="請選擇對應帳戶..." />
              </div>
            </div>

            <div class="add-panel-actions">
              <button class="btn-jelly btn-cancel-add" @click="isAddingRule = false" type="button">
                取消
              </button>
              <button class="btn-jelly btn-confirm-add" @click="handleSaveNewRule" type="button">
                儲存此對應規則 🐾
              </button>
            </div>
          </div>
        </Transition>

        <!-- 固定統計列 (不隨捲軸滾動) -->
        <div class="rules-header-summary">
          <span class="rules-count-text">
            已建立 <strong>{{ rulesList.length }}</strong> 筆分類帳戶對應規則
          </span>
          <span class="rules-hint-text">💡 點選帳戶可直接切換</span>
        </div>

        <!-- 規則列表滾動區塊 -->
        <div class="rules-scroll-area">
          <!-- 空狀態 -->
          <div v-if="rulesList.length === 0" class="empty-rules-state card-jelly">
            <div class="empty-cat-emoji">🐱📖</div>
            <h4 class="empty-title">目前尚未建立分類帳戶對應喔！</h4>
            <p class="empty-desc">
              您可以點擊上方的<strong>「從記帳歷史一鍵學習」</strong>按鈕，逗逗貓將會為您提煉過往紀錄；或是平時在記帳頁面完成記帳，系統就會自動為您記下對應帳戶喵！
            </p>
            <button class="btn-jelly btn-empty-extract" @click="handleExtractFromHistory" type="button">
              🐾 立即從歷史記帳紀錄提煉學習
            </button>
          </div>

          <!-- 規則清單 -->
          <div v-else class="rules-list-container">
            <div 
              v-for="rule in rulesList" 
              :key="rule.key" 
              class="rule-item-card"
            >
              <!-- 上層：分類資訊與刪除按鈕 -->
              <div class="rule-header-row">
                <div class="rule-cat-info">
                  <span class="rule-cat-emoji">{{ getCatEmojiByName(rule.category) }}</span>
                  <div class="rule-cat-texts">
                    <span class="rule-main-cat">{{ rule.category }}</span>
                    <span v-if="rule.subCategory" class="rule-sub-cat">
                      <span class="sub-arrow">↳</span> {{ rule.subCategory }}
                    </span>
                    <span v-else class="rule-sub-all">
                      (全分類通用)
                    </span>
                  </div>
                </div>

                <!-- 統一刪除按鈕 -->
                <button 
                  class="btn-jelly btn-delete-rule" 
                  @click.stop="handleDeleteRule(rule.key)" 
                  type="button"
                  title="解除此對應規則"
                >
                  <Trash2 :size="16" />
                </button>
              </div>

              <!-- 下層：全寬帳戶選單 -->
              <div class="rule-dropdown-wrapper">
                <AccountDropdown 
                  :model-value="rule.accountId" 
                  :accounts="accounts"
                  @update:model-value="(newId) => handleChangeAccount(rule.category, rule.subCategory, newId)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 底部關閉按鈕 -->
        <div class="modal-footer">
          <button class="btn-jelly btn-footer-close" @click="emit('close')" type="button">
            完成並返回設定 🐾
          </button>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<style scoped>
.map-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(61, 43, 31, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.map-modal-container {
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  background-color: var(--color-bg-warm, #FFF8EC);
  border: var(--border-width, 2.5px) solid var(--color-border, #2C1E1B);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 36px rgba(61, 43, 31, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background-color: #FFFDF9;
  border-bottom: 1.5px solid var(--color-border, #E8D8C8);
  flex-shrink: 0;
}

.btn-back-header,
.btn-close-header {
  background: none;
  border: none;
  color: var(--color-text-dark, #3D2B1F);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 12px;
}

.btn-back-header:hover,
.btn-close-header:hover {
  background-color: #F5EAE0;
}

.header-title-box {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.modal-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-dark, #3D2B1F);
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.user-pill-badge {
  font-size: 11px;
  background-color: #FFE6CA;
  color: #B25E00;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 700;
}

.intro-banner {
  margin: 8px 16px 6px;
  background-color: #FFFDF9;
  border: 1.5px solid #F0DFCE;
  border-radius: 14px;
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.intro-icon {
  font-size: 20px;
  line-height: 1;
}

.intro-content {
  flex: 1;
}

.intro-text {
  font-size: 11px;
  color: var(--color-text-dark, #3D2B1F);
  line-height: 1.4;
  margin: 0;
}

.intro-subtext {
  display: none; /* 精簡化：避免佔用過多手機空間 */
}

.modal-actions-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 16px;
  flex-shrink: 0;
}

.btn-tool-primary {
  flex: 1;
  min-width: 0;
  background-color: var(--color-income, #7AC74F);
  color: #fff;
  border: none;
  padding: 8px 10px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 3px 6px rgba(122, 199, 79, 0.3);
}

.btn-tool-secondary {
  flex: 1;
  min-width: 0;
  background-color: #FFE6A7;
  color: #7B4B00;
  border: none;
  padding: 8px 10px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-tool-danger {
  flex-shrink: 0;
  background-color: #FFEBE8;
  color: var(--color-expense, #E06D53);
  border: none;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  white-space: nowrap;
}

@media (max-width: 380px) {
  .modal-actions-bar {
    gap: 6px;
    padding: 6px 12px;
  }
  .btn-tool-primary,
  .btn-tool-secondary {
    padding: 7px 6px;
    font-size: 12px;
    gap: 4px;
  }
  .btn-tool-danger {
    padding: 7px 8px;
    font-size: 12px;
    gap: 3px;
  }
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ➕ 新增面板 */
.add-rule-panel {
  margin: 8px 16px;
  background-color: #FFFDF9;
  border: 1.5px dashed var(--color-income, #7AC74F);
  border-radius: 18px;
  padding: 12px 14px;
  flex-shrink: 0;
}

.add-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.add-panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-dark, #3D2B1F);
}

.btn-close-sub {
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.add-fields-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.field-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted, #8C7A6B);
  margin-bottom: 2px;
  display: block;
}

.cute-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1.5px solid var(--color-border, #E8D8C8);
  background-color: #fff;
  font-size: 13px;
  color: var(--color-text-dark, #3D2B1F);
  outline: none;
  font-family: inherit;
}

.add-panel-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel-add {
  background-color: #F0E6DC;
  border: none;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-dark);
  cursor: pointer;
}

.btn-confirm-add {
  background-color: var(--color-income, #7AC74F);
  color: #fff;
  border: none;
  padding: 6px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(122, 199, 79, 0.3);
}

/* 規則滾動清單 */
.rules-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
}

.rules-header-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-muted, #8C7A6B);
  padding: 6px 20px 4px;
  flex-shrink: 0;
}

.empty-rules-state {
  background-color: #FFFDF9;
  border: 2px dashed var(--color-border, #E8D8C8);
  border-radius: 20px;
  padding: 24px 16px;
  text-align: center;
  margin: 16px 0;
}

.empty-cat-emoji {
  font-size: 38px;
  margin-bottom: 8px;
}

.empty-title {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-dark, #3D2B1F);
}

.empty-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-muted, #8C7A6B);
  max-width: 360px;
  margin: 0 auto 16px auto;
}

.btn-empty-extract {
  background-color: #FFE6A7;
  color: #7B4B00;
  border: none;
  padding: 10px 18px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(123, 75, 0, 0.15);
}

.rules-list-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 🌟 全平台統一規則卡片結構 (Web 與 Mobile 100% 一致) */
.rule-item-card {
  margin: 0 !important;
  background-color: #FFFDF9;
  border: 1.5px solid var(--color-border, #E8D8C8);
  border-radius: 12px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 2px 4px rgba(61, 43, 31, 0.04);
}

.rule-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.rule-cat-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.rule-cat-emoji {
  font-size: 20px;
  flex-shrink: 0;
}

.rule-cat-texts {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  flex-wrap: wrap;
}

.rule-main-cat {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--color-text-dark, #3D2B1F);
  white-space: nowrap;
}

.rule-sub-cat {
  font-size: 11px;
  font-weight: 700;
  color: #C26300;
  background-color: #FFF4E5;
  padding: 1px 6px;
  border-radius: 6px;
  white-space: nowrap;
}

.sub-arrow {
  color: #C26300;
}

.rule-sub-all {
  font-size: 11px;
  color: var(--color-text-muted, #8C7A6B);
}

.rule-dropdown-wrapper {
  width: 100%;
}

.btn-delete-rule {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  background: none;
  border: none;
  color: #B5A191;
  padding: 0;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-delete-rule:hover {
  background-color: #FFEBE8;
  color: var(--color-expense, #E06D53);
}

.btn-delete-rule:active {
  transform: scale(0.9);
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1.5px solid var(--color-border, #E8D8C8);
  background-color: #FFFDF9;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.btn-footer-close {
  width: 100%;
  background-color: var(--color-text-dark, #3D2B1F);
  color: #fff;
  border: none;
  padding: 10px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

/* 動畫 */
.fade-page-enter-active,
.fade-page-leave-active {
  transition: opacity 0.2s ease;
}
.fade-page-enter-from,
.fade-page-leave-to {
  opacity: 0;
}
</style>
