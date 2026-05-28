<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useLedger } from '../composables/useLedger'
import { useConfirm } from '../composables/useConfirm'
import { useAlert } from '../composables/useAlert'
import { 
  FolderPlus, 
  Trash2, 
  GripVertical,
  X 
} from 'lucide-vue-next'

const { categories, addCategory, deleteCategory, addSubCategory, deleteSubCategory, reorderCategories, reorderSubCategories } = useLedger()
const { showConfirm } = useConfirm()
const { showAlert } = useAlert()

// 🐾 記帳分類手動管理狀態與方法
const activeCatType = ref<'expense' | 'income'>('expense')
const expandedCatId = ref<string>('')

// 設置預設展開第一個主分類
const filteredCategories = computed(() =>
  categories.value.filter(c => c.type === activeCatType.value)
)

watch(filteredCategories, (cats) => {
  if (cats.length > 0 && !cats.find(c => c.id === expandedCatId.value)) {
    expandedCatId.value = cats[0].id
  }
}, { immediate: true })

const toggleExpandCat = (catId: string) => {
  expandedCatId.value = expandedCatId.value === catId ? '' : catId
}

// 新增主分類狀態
const showAddCatForm = ref(false)
const newCatName = ref('')
const newCatIcon = ref('Sparkles')
const cuteIconsList = ['Sparkles', 'Utensils', 'Car', 'ShoppingBag', 'Home', 'DollarSign', 'TrendingUp', 'Gift', 'Briefcase', 'Heart', 'Smile', 'Activity']

const handleAddMainCategory = async () => {
  if (!newCatName.value.trim()) return
  
  await addCategory({
    name: newCatName.value.trim(),
    type: activeCatType.value,
    icon: newCatIcon.value,
    subCategories: []
  })
  
  newCatName.value = ''
  showAddCatForm.value = false
  await showAlert(`🐱 成功新增主分類！`)
}

const handleDeleteMainCategory = async (catId: string) => {
  const cat = categories.value.find(c => c.id === catId)
  if (!cat) return
  
  if (!(await showConfirm(`確定要刪除「${cat.name}」主分類及其底下所有子分類嗎喵？（已記帳交易不受影響）`, '🗑️ 刪除主分類'))) {
    return
  }
  
  await deleteCategory(catId)
  
  const nextCat = filteredCategories.value.find(c => c.id !== catId)
  expandedCatId.value = nextCat ? nextCat.id : ''
  await showAlert(`🐱 主分類「${cat.name}」已被刪除。`)
}

// 子分類狀態與方法
const newSubCatName = ref<Record<string, string>>({})

const handleAddSubCategory = async (catId: string) => {
  const subName = (newSubCatName.value[catId] || '').trim()
  if (!subName) return
  
  const cat = categories.value.find(c => c.id === catId)
  if (cat?.subCategories.includes(subName)) {
    await showAlert('🐱 這個子分類已經存在囉喵！')
    return
  }
  
  await addSubCategory(catId, subName)
  newSubCatName.value[catId] = ''
}

const handleDeleteSubCategory = async (catId: string, subName: string) => {
  await deleteSubCategory(catId, subName)
}

// ===== 主分類拖曳排序 =====
const catDragSrcId = ref<string | null>(null)
const catDragOverId = ref<string | null>(null)

const onCatDragStart = (catId: string) => { catDragSrcId.value = catId }
const onCatDragOver = (catId: string) => { catDragOverId.value = catId }
const onCatDragLeave = () => { catDragOverId.value = null }
const onCatDragEnd = () => { catDragSrcId.value = null; catDragOverId.value = null }

const onCatDrop = async (targetCat: typeof filteredCategories.value[0]) => {
  const src = catDragSrcId.value
  catDragSrcId.value = null
  catDragOverId.value = null
  if (!src || src === targetCat.id) return

  const list = [...filteredCategories.value]
  const srcIdx = list.findIndex(c => c.id === src)
  const dstIdx = list.findIndex(c => c.id === targetCat.id)
  const [item] = list.splice(srcIdx, 1)
  list.splice(dstIdx, 0, item)
  await reorderCategories(list, activeCatType.value)
}

// ===== 子分類拖曳排序 =====
const subDragKey = ref<string | null>(null)   // 'catId::subName'
const subDragOverKey = ref<string | null>(null)

const subKey = (catId: string, sub: string) => `${catId}::${sub}`
const onSubDragStart = (catId: string, sub: string) => { subDragKey.value = subKey(catId, sub) }
const onSubDragOver = (catId: string, sub: string) => { subDragOverKey.value = subKey(catId, sub) }
const onSubDragLeave = () => { subDragOverKey.value = null }
const onSubDragEnd = () => { subDragKey.value = null; subDragOverKey.value = null }

const onSubDrop = async (catId: string, targetSub: string) => {
  const srcKey = subDragKey.value
  subDragKey.value = null
  subDragOverKey.value = null
  if (!srcKey) return
  const [srcCatId, srcSub] = srcKey.split('::')
  if (srcCatId !== catId || srcSub === targetSub) return

  const cat = categories.value.find(c => c.id === catId)
  if (!cat) return
  const subs = [...cat.subCategories]
  const srcIdx = subs.indexOf(srcSub)
  const dstIdx = subs.indexOf(targetSub)
  subs.splice(srcIdx, 1)
  subs.splice(dstIdx, 0, srcSub)
  await reorderSubCategories(catId, subs)
}
</script>

<template>
  <div class="category-manager-page pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><FolderPlus class="icon-inline" /> 記帳分類管理大師</h2>
      <p class="page-subtitle">自由客製您的雙層收支分類，讓每一筆交易精準歸宿</p>
    </div>

    <!-- 1. 自訂分類手動管理面板 -->
    <div class="settings-box card-jelly">
      <h3 class="box-title"><FolderPlus :size="16" class="icon-inline" /> 🐾 分類架構設定</h3>
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
          v-for="cat in filteredCategories"
          :key="cat.id"
          class="cat-accordion-item card-jelly"
          :class="{ 
            'expanded': expandedCatId === cat.id,
            'is-dragging': catDragSrcId === cat.id,
            'drag-over': catDragOverId === cat.id
          }"
          @dragover.prevent="onCatDragOver(cat.id)"
          @dragleave="onCatDragLeave"
          @drop.prevent="onCatDrop(cat)"
          @dragend="onCatDragEnd"
        >
          <!-- 卡片 Header：點擊展開子分類 -->
          <div class="accordion-header" @click="toggleExpandCat(cat.id)">
            <div class="header-left">
              <!-- 拖曳把手 -->
              <span
                class="drag-handle"
                draggable="true"
                @dragstart.stop="onCatDragStart(cat.id)"
                @click.stop
                title="拖曳調整順序"
              >
                <GripVertical :size="13" />
              </span>
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
                  :class="{ 'is-dragging': subDragKey === subKey(cat.id, sub), 'drag-over': subDragOverKey === subKey(cat.id, sub) }"
                  draggable="true"
                  @dragstart="onSubDragStart(cat.id, sub)"
                  @dragover.prevent="onSubDragOver(cat.id, sub)"
                  @dragleave="onSubDragLeave"
                  @drop.prevent="onSubDrop(cat.id, sub)"
                  @dragend="onSubDragEnd"
                >
                  <GripVertical :size="10" class="sub-grip" />
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
.category-manager-page {
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

.settings-box {
  margin-bottom: 20px;
  text-align: left;
}

.box-title {
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

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
  transition: opacity 0.15s, box-shadow 0.15s;
}

.cat-accordion-item.is-dragging {
  opacity: 0.4;
}

.cat-accordion-item.drag-over {
  box-shadow: 0 0 0 2.5px var(--color-text-dark) !important;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  cursor: grab;
  opacity: 0.3;
  padding: 2px 3px;
  border-radius: 4px;
  flex-shrink: 0;
}

.drag-handle:hover {
  opacity: 0.65;
  background-color: rgba(0, 0, 0, 0.06);
}

.drag-handle:active {
  cursor: grabbing;
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
  padding: 4px 8px 4px 6px !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: var(--shadow-jelly-sm-sm, 1px 1px 0 0 #2C1E1B) !important;
  cursor: grab;
  transition: opacity 0.15s, box-shadow 0.15s;
}

.sub-cute-pill.is-dragging {
  opacity: 0.35;
}

.sub-cute-pill.drag-over {
  box-shadow: 0 0 0 2px var(--color-text-dark) !important;
}

.sub-grip {
  opacity: 0.3;
  flex-shrink: 0;
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
</style>
