<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string  // 'YYYY-MM-DD'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const isOpen = ref(false)
const pickerRef = ref<HTMLElement | null>(null)

// 從 modelValue 初始化
const parseDate = (str: string) => {
  const [y, m, d] = str.split('-').map(Number)
  return { 
    y: y || new Date().getFullYear(), 
    m: m || new Date().getMonth() + 1, 
    d: d || new Date().getDate() 
  }
}

const state = ref(parseDate(props.modelValue))

watch(() => props.modelValue, (val) => {
  state.value = parseDate(val)
})

const emit_change = () => {
  const { y, m, d } = state.value
  emit('update:modelValue', `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
}

// 月份天數
const daysInMonth = computed(() => new Date(state.value.y, state.value.m, 0).getDate())

// 月份首日是星期幾 (0=日)
const firstDayOfWeek = computed(() => new Date(state.value.y, state.value.m - 1, 1).getDay())

// 日曆格子 (null = 空格)
const calendarCells = computed(() => {
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek.value; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth.value; d++) cells.push(d)
  return cells
})

const prevMonth = () => {
  let { y, m } = state.value
  m--
  if (m < 1) { m = 12; y-- }
  state.value = { y, m, d: Math.min(state.value.d, new Date(y, m, 0).getDate()) }
  emit_change()
}

const nextMonth = () => {
  let { y, m } = state.value
  m++
  if (m > 12) { m = 1; y++ }
  state.value = { y, m, d: Math.min(state.value.d, new Date(y, m, 0).getDate()) }
  emit_change()
}

const selectDay = (d: number | null) => {
  if (!d) return
  state.value = { ...state.value, d }
  emit_change()
  isOpen.value = false // 選擇完日期後，自動收起面板！
}

// ─── 快速年月份跳轉 (自定義 Q 彈 Popover) ───
const years = computed(() => {
  const currentYear = new Date().getFullYear()
  const list: number[] = []
  for (let y = currentYear - 10; y <= currentYear + 5; y++) {
    list.push(y)
  }
  return list
})

const isYearSelectOpen = ref(false)
const isMonthSelectOpen = ref(false)

const handleYearSelect = (year: number) => {
  const m = state.value.m
  const maxD = new Date(year, m, 0).getDate()
  const d = Math.min(state.value.d, maxD)
  state.value = { y: year, m, d }
  emit_change()
  isYearSelectOpen.value = false
}

const handleMonthSelect = (month: number) => {
  const y = state.value.y
  const maxD = new Date(y, month, 0).getDate()
  const d = Math.min(state.value.d, maxD)
  state.value = { y, m: month, d }
  emit_change()
  isMonthSelectOpen.value = false
}

const displayHeader = computed(() => `${state.value.y} 年 ${state.value.m} 月`)

const isToday = (d: number | null) => {
  if (!d) return false
  const today = new Date()
  return d === today.getDate() && state.value.m === today.getMonth() + 1 && state.value.y === today.getFullYear()
}

// ─── Trigger Button Label ───
const displayLabel = computed(() => {
  const { y, m, d } = state.value
  return `${y} 年 ${m} 月 ${d} 日`
})

// ─── 點擊外部關閉 ───
const handleClickOutside = (event: MouseEvent) => {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    isOpen.value = false
    isYearSelectOpen.value = false
    isMonthSelectOpen.value = false
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
  <div class="date-picker-container" ref="pickerRef">
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
        <!-- 月份導航與快速跳轉 (自定義 Q 彈 Popover) -->
        <div class="dp-header">
          <button class="picker-nav-btn" @click="prevMonth" type="button" aria-label="上個月">
            <ChevronLeft :size="14" />
          </button>
          <div class="dp-header-selects">
            <!-- 自定義年份選取器 -->
            <div class="custom-select-container">
              <button 
                class="btn-jelly custom-select-trigger" 
                @click.stop="isYearSelectOpen = !isYearSelectOpen; isMonthSelectOpen = false"
                type="button"
              >
                {{ state.y }} 年
              </button>
              <Transition name="fade-popover">
                <div v-if="isYearSelectOpen" class="custom-select-dropdown card-jelly">
                  <button 
                    v-for="year in years" 
                    :key="year"
                    class="select-option btn-jelly"
                    :class="{ active: state.y === year }"
                    @click="handleYearSelect(year)"
                    type="button"
                  >
                    {{ year }} 年
                  </button>
                </div>
              </Transition>
            </div>

            <!-- 自定義月份選取器 -->
            <div class="custom-select-container">
              <button 
                class="btn-jelly custom-select-trigger" 
                @click.stop="isMonthSelectOpen = !isMonthSelectOpen; isYearSelectOpen = false"
                type="button"
              >
                {{ state.m }} 月
              </button>
              <Transition name="fade-popover">
                <div v-if="isMonthSelectOpen" class="custom-select-dropdown card-jelly month-dropdown">
                  <button 
                    v-for="month in 12" 
                    :key="month"
                    class="select-option btn-jelly"
                    :class="{ active: state.m === month }"
                    @click="handleMonthSelect(month)"
                    type="button"
                  >
                    {{ month }} 月
                  </button>
                </div>
              </Transition>
            </div>
          </div>
          <button class="picker-nav-btn" @click="nextMonth" type="button" aria-label="下個月">
            <ChevronRight :size="14" />
          </button>
        </div>

        <!-- 星期標頭 -->
        <div class="dp-weekdays">
          <span v-for="w in ['日','一','二','三','四','五','六']" :key="w" class="dp-weekday">{{ w }}</span>
        </div>

        <!-- 日曆格 -->
        <div class="dp-days-grid">
          <button
            v-for="(cell, i) in calendarCells"
            :key="i"
            class="dp-day-btn"
            :class="{
              'active': cell === state.d,
              'is-today': isToday(cell),
              'is-empty': !cell
            }"
            :disabled="!cell"
            @click="selectDay(cell)"
            type="button"
          >
            {{ cell ?? '' }}
          </button>
        </div>

        <!-- 已選日期標示 -->
        <div class="dp-selected-display">
          已選：{{ state.y }}/{{ String(state.m).padStart(2,'0') }}/{{ String(state.d).padStart(2,'0') }}
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.date-picker-container {
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
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.dp-header-selects {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* 自定義下拉選單樣式 */
.custom-select-container {
  position: relative;
  display: inline-block;
}

.custom-select-trigger {
  font-size: 13px !important;
  font-weight: 800 !important;
  color: var(--color-text-dark) !important;
  background-color: var(--color-bg-warm) !important;
  border: var(--border-width) solid var(--color-border) !important;
  border-radius: var(--border-radius-sm) !important;
  padding: 4px 10px !important;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm) !important;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 76px; /* 稍微調寬，確保單行文字寬度充足 */
  justify-content: center;
  white-space: nowrap; /* 確保不換行 */
}

.custom-select-trigger:hover {
  background-color: #FFFFFF !important;
}

.custom-select-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 120;
  background-color: #FFFFFF !important;
  border: var(--border-width) solid var(--color-border) !important;
  border-radius: var(--border-radius-md) !important;
  box-shadow: var(--shadow-jelly-lg) !important;
  padding: 6px !important;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
  min-width: 96px; /* 調整下拉寬度 */
}

.month-dropdown {
  min-width: 76px;
}

.select-option {
  width: 100% !important;
  padding: 6px 10px !important;
  font-size: 12px !important;
  font-weight: 800 !important;
  background-color: var(--color-bg-warm) !important;
  border-color: var(--color-border) !important;
  box-shadow: var(--shadow-jelly-sm-sm) !important;
  text-align: center;
  margin-bottom: 0 !important;
  flex-shrink: 0;
  white-space: nowrap; /* 確保不換行 */
}

.select-option:hover {
  background-color: #FFFFFF !important;
}

.select-option.active {
  background-color: var(--color-income) !important;
  border-width: 2px !important;
}

/* Popover 動畫 */
.fade-popover-enter-active,
.fade-popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.fade-popover-enter-from,
.fade-popover-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px) scale(0.9);
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

.dp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.dp-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  padding: 2px 0;
}

.dp-days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.dp-day-btn {
  aspect-ratio: 1;
  font-size: 12px;
  font-weight: 700;
  border-radius: var(--border-radius-sm) !important;
  background-color: var(--color-bg-warm) !important;
  padding: 0 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  border: var(--border-width) solid var(--color-border);
  cursor: pointer;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dp-day-btn:active:not(.is-empty) {
  transform: scale(0.9);
  box-shadow: var(--shadow-jelly-active);
}

.dp-day-btn.is-empty {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  cursor: default;
}

.dp-day-btn.active {
  background-color: var(--color-income) !important;
  box-shadow: var(--shadow-jelly-active) !important;
  transform: translate(1px, 1px);
  font-weight: 800;
}

.dp-day-btn.is-today:not(.active) {
  background-color: var(--color-accent-gold) !important;
}

.dp-selected-display {
  margin-top: 4px;
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  border-top: 1.5px dashed var(--color-border);
  padding-top: 6px;
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
