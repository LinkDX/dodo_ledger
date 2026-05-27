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

// ─── 快速年月份跳轉 ───
const years = computed(() => {
  const currentYear = new Date().getFullYear()
  const list: number[] = []
  for (let y = currentYear - 10; y <= currentYear + 5; y++) {
    list.push(y)
  }
  return list
})

const handleYearChange = (event: Event) => {
  const y = Number((event.target as HTMLSelectElement).value)
  const m = state.value.m
  const maxD = new Date(y, m, 0).getDate()
  const d = Math.min(state.value.d, maxD)
  state.value = { y, m, d }
  emit_change()
}

const handleMonthChange = (event: Event) => {
  const y = state.value.y
  const m = Number((event.target as HTMLSelectElement).value)
  const maxD = new Date(y, m, 0).getDate()
  const d = Math.min(state.value.d, maxD)
  state.value = { y, m, d }
  emit_change()
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
        <!-- 月份導航與快速跳轉 -->
        <div class="dp-header">
          <button class="picker-nav-btn" @click="prevMonth" type="button" aria-label="上個月">
            <ChevronLeft :size="14" />
          </button>
          <div class="dp-header-selects">
            <select :value="state.y" @change="handleYearChange" class="dp-select header-select" type="button">
              <option v-for="year in years" :key="year" :value="year">{{ year }} 年</option>
            </select>
            <select :value="state.m" @change="handleMonthChange" class="dp-select header-select" type="button">
              <option v-for="month in 12" :key="month" :value="month">{{ month }} 月</option>
            </select>
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

.header-select {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-dark);
  background-color: var(--color-bg-warm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--border-radius-sm);
  padding: 4px 24px 4px 8px;
  cursor: pointer;
  box-shadow: var(--shadow-jelly-sm);
  outline: none;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  appearance: none; /* 去掉原生下拉箭頭，改用背景圖示或簡約無圖示 */
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%233D2B1F' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.header-select:hover {
  background-color: #FFFFFF;
  transform: scale(1.05);
}

.header-select:active {
  transform: scale(0.95);
  box-shadow: var(--shadow-jelly-active);
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
