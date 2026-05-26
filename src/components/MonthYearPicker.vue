<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: string // YYYY-MM (month) 或 YYYY (year)
    mode?: 'month' | 'year'
    availableMonths?: string[] // YYYY-MM 格式陣列，用於限制可選範圍
  }>(),
  {
    mode: 'month'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const isOpen = ref(false)
const pickerRef = ref<HTMLElement | null>(null)

// ──── Month Mode 狀態 ────
const viewYear = ref(new Date().getFullYear())

// ──── Year Mode 狀態 ────
const viewYearStart = ref(new Date().getFullYear() - 4)

// 初始化狀態
const initViewState = () => {
  if (props.mode === 'month') {
    const parts = props.modelValue.split('-')
    const y = parseInt(parts[0])
    if (!isNaN(y)) {
      viewYear.value = y
    } else {
      viewYear.value = new Date().getFullYear()
    }
  } else {
    const y = parseInt(props.modelValue)
    if (!isNaN(y)) {
      viewYearStart.value = y - 4
    } else {
      viewYearStart.value = new Date().getFullYear() - 4
    }
  }
}

// 監聽 modelValue / mode
watch(() => props.modelValue, initViewState, { immediate: true })
watch(() => props.mode, initViewState)

// ─── Trigger Button Label ───
const displayLabel = computed(() => {
  if (props.mode === 'month') {
    const parts = props.modelValue.split('-')
    if (parts.length >= 2) {
      return `${parts[0]} 年 ${parseInt(parts[1])} 月`
    }
    return props.modelValue
  } else {
    return `${props.modelValue} 年`
  }
})

// ─── Month Mode 邏輯 ───
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const isMonthAvailable = (m: number) => {
  if (!props.availableMonths) return true
  const monthStr = `${viewYear.value}-${String(m).padStart(2, '0')}`
  return props.availableMonths.includes(monthStr)
}

const isMonthActive = (m: number) => {
  if (props.mode !== 'month') return false
  const monthStr = `${viewYear.value}-${String(m).padStart(2, '0')}`
  return props.modelValue === monthStr
}

const selectMonth = (m: number) => {
  if (!isMonthAvailable(m)) return
  const monthStr = `${viewYear.value}-${String(m).padStart(2, '0')}`
  emit('update:modelValue', monthStr)
  isOpen.value = false
}

const changeViewYear = (delta: number) => {
  viewYear.value += delta
}

// ─── Year Mode 邏輯 ───
const yearsInGrid = computed(() => {
  const list = []
  for (let i = 0; i < 9; i++) {
    list.push(viewYearStart.value + i)
  }
  return list
})

const isYearAvailable = (y: number) => {
  if (!props.availableMonths) return true
  return props.availableMonths.some(mStr => mStr.startsWith(`${y}-`))
}

const isYearActive = (y: number) => {
  if (props.mode !== 'year') return false
  return parseInt(props.modelValue) === y
}

const selectYear = (y: number) => {
  if (!isYearAvailable(y)) return
  emit('update:modelValue', String(y))
  isOpen.value = false
}

const changeViewYearStart = (delta: number) => {
  viewYearStart.value += delta
}

// ─── 點擊外部關閉 ───
const handleClickOutside = (event: MouseEvent) => {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<template>
  <div class="month-year-picker-container" ref="pickerRef">
    <!-- 觸發按鈕 -->
    <button class="picker-trigger" @click="isOpen = !isOpen" type="button">
      <div class="trigger-left">
        <Calendar :size="14" class="calendar-icon" />
        <span>{{ displayLabel }}</span>
      </div>
      <ChevronDown :size="14" class="arrow-icon" :class="{ 'arrow-up': isOpen }" />
    </button>

    <!-- 下拉面板 -->
    <transition name="fade">
      <div v-if="isOpen" class="picker-dropdown card-jelly">
        <!-- 1. 月份模式 -->
        <template v-if="mode === 'month'">
          <div class="picker-header">
            <button class="picker-nav-btn" @click="changeViewYear(-1)" type="button">
              <ChevronLeft :size="14" />
            </button>
            <span class="header-title">{{ viewYear }} 年</span>
            <button class="picker-nav-btn" @click="changeViewYear(1)" type="button">
              <ChevronRight :size="14" />
            </button>
          </div>

          <div class="picker-grid grid-3x4">
            <button
              v-for="m in months"
              :key="m"
              class="grid-item"
              :class="{ active: isMonthActive(m) }"
              :disabled="!isMonthAvailable(m)"
              @click="selectMonth(m)"
              type="button"
            >
              {{ m }} 月
            </button>
          </div>
        </template>

        <!-- 2. 年份模式 -->
        <template v-else>
          <div class="picker-header">
            <button class="picker-nav-btn" @click="changeViewYearStart(-9)" type="button">
              <ChevronLeft :size="14" />
            </button>
            <span class="header-title">{{ viewYearStart }} - {{ viewYearStart + 8 }}</span>
            <button class="picker-nav-btn" @click="changeViewYearStart(9)" type="button">
              <ChevronRight :size="14" />
            </button>
          </div>

          <div class="picker-grid grid-3x3">
            <button
              v-for="y in yearsInGrid"
              :key="y"
              class="grid-item"
              :class="{ active: isYearActive(y) }"
              :disabled="!isYearAvailable(y)"
              @click="selectYear(y)"
              type="button"
            >
              {{ y }}
            </button>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.month-year-picker-container {
  position: relative;
  display: block;
  width: 100%;
}

.picker-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background-color: var(--color-card-bg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-jelly-sm);
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.picker-trigger:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-jelly-active);
}

.trigger-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.calendar-icon {
  color: var(--color-text-muted);
}

.arrow-icon {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.arrow-up {
  transform: rotate(180deg);
}

.picker-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 100;
  background-color: var(--color-card-bg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-jelly);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 年份導覽列 */
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.header-title {
  font-size: 15px;
  font-weight: 800;
}

.picker-nav-btn {
  width: 32px;
  height: 32px;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-bg-warm);
  box-shadow: var(--shadow-jelly-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}

.picker-nav-btn:active {
  transform: scale(0.92);
  box-shadow: var(--shadow-jelly-active);
}

.picker-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 網格系統 */
.picker-grid {
  display: grid;
  gap: 8px;
}

.grid-3x4 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-3x3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-item {
  padding: 8px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-bg-warm);
  box-shadow: var(--shadow-jelly-sm);
  cursor: pointer;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.grid-item:active:not(:disabled) {
  transform: scale(0.92);
  box-shadow: var(--shadow-jelly-active);
}

.grid-item.active {
  background-color: var(--color-accent-gold) !important;
  box-shadow: var(--shadow-jelly-active) !important;
  transform: translate(1px, 1px);
}

.grid-item:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background-color: #f3f3f3;
  border-color: #d8d8d8;
  color: #a0a0a0;
  box-shadow: none;
  transform: none !important;
}

/* 動畫 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
