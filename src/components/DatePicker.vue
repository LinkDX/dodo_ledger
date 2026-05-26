<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string  // 'YYYY-MM-DD'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

// 從 modelValue 初始化
const parseDate = (str: string) => {
  const [y, m, d] = str.split('-').map(Number)
  return { y: y || new Date().getFullYear(), m: m || new Date().getMonth() + 1, d: d || new Date().getDate() }
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
}

const displayHeader = computed(() => `${state.value.y} 年 ${state.value.m} 月`)

const isToday = (d: number | null) => {
  if (!d) return false
  const today = new Date()
  return d === today.getDate() && state.value.m === today.getMonth() + 1 && state.value.y === today.getFullYear()
}
</script>

<template>
  <div class="date-picker card-jelly">
    <!-- 月份導航 -->
    <div class="dp-header">
      <button class="btn-jelly nav-btn" @click="prevMonth" aria-label="上個月">
        <ChevronLeft :size="14" />
      </button>
      <span class="dp-header-label">{{ displayHeader }}</span>
      <button class="btn-jelly nav-btn" @click="nextMonth" aria-label="下個月">
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
          'btn-jelly': !!cell,
          'is-selected': cell === state.d,
          'is-today': isToday(cell),
          'is-empty': !cell
        }"
        :disabled="!cell"
        @click="selectDay(cell)"
      >
        {{ cell ?? '' }}
      </button>
    </div>

    <!-- 已選日期標示 -->
    <div class="dp-selected-display">
      已選：{{ state.y }}/{{ String(state.m).padStart(2,'0') }}/{{ String(state.d).padStart(2,'0') }}
    </div>
  </div>
</template>

<style scoped>
.date-picker {
  padding: 12px !important;
  background-color: #ffffff;
  user-select: none;
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.dp-header-label {
  font-size: 13px;
  font-weight: 800;
}

.nav-btn {
  width: 30px;
  height: 30px;
  padding: 0 !important;
  background-color: var(--color-bg-warm) !important;
  border-radius: var(--border-radius-sm) !important;
}

.dp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}

.dp-weekday {
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  color: var(--color-text-muted);
  padding: 2px 0;
}

.dp-days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
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
  transition: all 0.1s ease;
}

.dp-day-btn.is-empty {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  cursor: default;
}

.dp-day-btn.is-selected {
  background-color: var(--color-income) !important;
  border-width: 2.5px;
  font-weight: 800;
}

.dp-day-btn.is-today:not(.is-selected) {
  background-color: var(--color-accent-gold) !important;
}

.dp-selected-display {
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  border-top: 1.5px dashed var(--color-border);
  padding-top: 6px;
}
</style>
