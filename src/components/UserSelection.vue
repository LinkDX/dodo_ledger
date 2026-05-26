<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import DodoCat from './DodoCat.vue'
import { Sparkles, Plus, Check, Trash2 } from 'lucide-vue-next'

const { profiles, createProfile, deleteProfile } = useAuth()

// 可愛頭像候選清單 (以馬卡龍色貓咪背景為主)
const avatars = [
  { char: '🐱', color: '#FFDAC1', name: '奶油黃貓' },
  { char: '🍑', color: '#FFB4B4', name: '蜜桃粉貓' },
  { char: '🧊', color: '#A9C9FF', name: '冰晶藍貓' },
  { char: '🍇', color: '#E2C6FF', name: '薰衣草紫貓' }
]

// 狀態管理
const isCreating = ref(false)
const newName = ref('')
const selectedAvatarIdx = ref(0)

const toggleCreate = () => {
  isCreating.value = !isCreating.value
  newName.value = ''
  selectedAvatarIdx.value = 0
}

const handleCreate = () => {
  if (!newName.value.trim()) return
  createProfile(
    newName.value.trim(), 
    avatars[selectedAvatarIdx.value].char
  )
  isCreating.value = false
  newName.value = ''
}

const handleDeleteProfile = async (id: string, name: string) => {
  if (window.confirm(`🐱 您確定要刪除身分「${name}」嗎？\n這將會清除與該身分相關的本地快取喔喵！`)) {
    await deleteProfile(id)
  }
}
</script>

<template>
  <div class="user-selection-page pop-jelly">
    <div class="header-section">
      <h1 class="brand-title">Dodo Ledger</h1>
      <p class="brand-subtitle">逗逗貓記帳小天地</p>
    </div>

    <!-- 逗逗貓大看板歡迎主人 -->
    <div class="mascot-welcome">
      <DodoCat 
        mood="happy" 
        speech="喵～歡迎來到 Dodo Ledger！請選擇您的身分，或是建立一個新的貓咪主人帳號喔！🐾" 
      />
    </div>

    <!-- 1. 新建主人彈窗 (Jelly Modal) -->
    <div v-if="isCreating" class="create-modal-overlay">
      <div class="create-card card-jelly pop-jelly">
        <h2 class="section-title"><Sparkles class="icon-inline" /> 建立新身分</h2>
        
        <div class="form-group">
          <label class="label-cute">主人暱稱</label>
          <input 
            v-model="newName" 
            type="text" 
            placeholder="輸入您的可愛名字..." 
            class="input-jelly"
            maxlength="10"
            @keyup.enter="handleCreate"
          />
        </div>

        <div class="form-group">
          <label class="label-cute">選擇陪伴貓咪</label>
          <div class="avatar-grid">
            <div 
              v-for="(av, idx) in avatars" 
              :key="idx"
              class="avatar-selector btn-jelly"
              :class="{ active: selectedAvatarIdx === idx }"
              :style="{ backgroundColor: av.color }"
              @click="selectedAvatarIdx = idx"
            >
              <span class="avatar-char">{{ av.char }}</span>
              <div v-if="selectedAvatarIdx === idx" class="check-badge">
                <Check :size="12" stroke-width="4" stroke="#FFF" />
              </div>
            </div>
          </div>
          <p class="avatar-desc">陪伴貓：{{ avatars[selectedAvatarIdx].name }} 🐾</p>
        </div>

        <div class="modal-actions">
          <button class="btn-jelly btn-cancel" @click="toggleCreate">取消</button>
          <button 
            class="btn-jelly btn-confirm" 
            :disabled="!newName.trim()" 
            @click="handleCreate"
          >
            建立身分
          </button>
        </div>
      </div>
    </div>

    <!-- 2. 使用者身分牆清單 -->
    <div v-else class="profiles-section">
      <h2 class="section-title">選擇您的記帳身分</h2>
      
      <div class="profiles-grid">
        <!-- 主人卡片 -->
        <div 
          v-for="prof in profiles" 
          :key="prof.id"
          class="profile-card card-jelly btn-jelly"
          @click="useAuth().switchProfile(prof.id)"
        >
          <div class="profile-left">
            <div class="profile-avatar-circle">
              <span class="profile-avatar-char">{{ prof.avatar }}</span>
            </div>
            <div class="profile-info">
              <h3 class="profile-name">{{ prof.name }}</h3>
              <p class="profile-date">自 {{ new Date(prof.createdAt).toLocaleDateString() }} 陪伴</p>
            </div>
          </div>
          
          <button 
            class="delete-profile-btn btn-jelly" 
            @click.stop="handleDeleteProfile(prof.id, prof.name)"
            title="刪除身分"
            type="button"
          >
            <Trash2 :size="14" />
          </button>
        </div>

        <!-- 建立新身分按鈕卡片 -->
        <div class="profile-card card-jelly create-card-btn btn-jelly" @click="toggleCreate">
          <div class="plus-circle">
            <Plus :size="28" stroke-width="3" />
          </div>
          <div class="profile-info">
            <h3 class="profile-name">建立新主人</h3>
            <p class="profile-date">新增一隻記帳陪伴貓咪</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-selection-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-height: 100vh;
  justify-content: center;
}

.header-section {
  text-align: center;
  margin-bottom: 10px;
}

.brand-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
  background: linear-gradient(135deg, var(--color-border), #7E6E6A);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-subtitle {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 4px;
  letter-spacing: 1px;
}

.mascot-welcome {
  width: 100%;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 16px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-inline {
  margin-right: 6px;
  color: var(--color-accent-gold);
}

/* 使用者清單牆 */
.profiles-section {
  width: 100%;
  max-width: 380px;
}

.profiles-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.profile-card {
  width: 100% !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  justify-content: space-between !important;
  padding: 16px !important;
  margin-bottom: 0;
  text-align: left;
}

.profile-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.delete-profile-btn {
  width: 32px;
  height: 32px;
  padding: 0 !important;
  border-radius: var(--border-radius-sm);
  background-color: var(--color-bg-warm) !important;
  border: var(--border-width) solid var(--color-border);
  box-shadow: var(--shadow-jelly-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.1s;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.delete-profile-btn:hover {
  color: #FF5A5A;
}

.delete-profile-btn:active {
  transform: scale(0.9) !important;
  box-shadow: var(--shadow-jelly-active) !important;
}

.profile-avatar-circle {
  width: 48px;
  height: 48px;
  background-color: var(--color-bg-warm);
  border: 2px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-jelly-sm);
}

.profile-avatar-char {
  font-size: 24px;
}

.profile-info {
  display: flex;
  flex-direction: column;
}

.profile-name {
  font-size: 16px;
  font-weight: 800;
}

.profile-date {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* 新建身分按鈕特別樣式 */
.create-card-btn {
  background-color: var(--color-bg-warm) !important;
  border-style: dashed;
}

.plus-circle {
  width: 48px;
  height: 48px;
  border: 2px dashed var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

/* 建立身分彈窗樣式 */
.create-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(44, 30, 27, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
  overflow-y: auto;
}

.create-card {
  width: 100%;
  max-width: 360px;
  background-color: #FFFFFF;
  margin: auto 0;
}

.form-group {
  margin-bottom: 16px;
  width: 100%;
}

.label-cute {
  font-size: 13px;
  font-weight: 800;
  display: block;
  margin-bottom: 6px;
  padding-left: 4px;
}

.avatar-grid {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
}

.avatar-selector {
  flex: 1;
  height: 52px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
  position: relative;
}

.avatar-char {
  font-size: 26px;
}

.avatar-selector.active {
  border-width: 3px;
  transform: scale(1.05);
}

.check-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  background-color: var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.avatar-desc {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-align: right;
  margin-top: 6px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-cancel {
  flex: 1;
  background-color: #FFF;
  color: var(--color-text-muted);
}

.btn-confirm {
  flex: 1;
  background-color: var(--color-income) !important;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}
</style>
