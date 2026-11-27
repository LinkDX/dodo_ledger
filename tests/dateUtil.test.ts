import { describe, it, expect } from 'vitest'
import { ref, watch, nextTick } from 'vue'
import {
  formatLocalDate,
  getTodayLocalDateString,
  getYesterdayLocalDateString,
  isDateToday,
  parseLocalDateToTimestamp,
  resolveAddTabDateChange
} from '../src/utils/date'

describe('📅 本地日期公用工具 (src/utils/date.ts)', () => {
  it('1. formatLocalDate 應正確將 Date 格式化為本地 YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 19, 3, 30, 0) // 本地 2026-10-19 03:30 (清晨時間)
    const formatted = formatLocalDate(d)
    expect(formatted).toBe('2026-10-19')
  })

  it('2. formatLocalDate 應正確將時間戳記格式化為本地 YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 5, 23, 59, 59) // 本地 2026-01-05 23:59:59
    const formatted = formatLocalDate(d.getTime())
    expect(formatted).toBe('2026-01-05')
  })

  it('3. getTodayLocalDateString 應與當天 Date 物件的年月日完全吻合', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(getTodayLocalDateString()).toBe(expected)
  })

  it('4. getYesterdayLocalDateString 應精準計算昨天的本地日期', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
    expect(getYesterdayLocalDateString()).toBe(expected)
  })

  it('5. isDateToday 應準確判斷今天字串、昨天字串與 Date 物件', () => {
    expect(isDateToday(getTodayLocalDateString())).toBe(true)
    expect(isDateToday(new Date())).toBe(true)
    expect(isDateToday(Date.now())).toBe(true)

    expect(isDateToday(getYesterdayLocalDateString())).toBe(false)
    expect(isDateToday('2020-01-01')).toBe(false)
  })

  it('6. parseLocalDateToTimestamp 應解析為本地時間', () => {
    const ts = parseLocalDateToTimestamp('2026-10-19')
    const parsedDate = new Date(ts)
    expect(parsedDate.getFullYear()).toBe(2026)
    expect(parsedDate.getMonth() + 1).toBe(10)
    expect(parsedDate.getDate()).toBe(19)
    // 預設歷史日期設定為本地 12:00:00
    expect(parsedDate.getHours()).toBe(12)
  })

  it('7. parseLocalDateToTimestamp 在今天且 preserveCurrentTime: true 時應保留當前時間', () => {
    const todayStr = getTodayLocalDateString()
    const before = Date.now()
    const ts = parseLocalDateToTimestamp(todayStr, { preserveCurrentTime: true })
    const after = Date.now()

    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('8. resolveAddTabDateChange 應在切入記帳頁且有預填日期時優先套用預填日期並消費', () => {
    expect(
      resolveAddTabDateChange({
        newTab: 'add',
        oldTab: 'transactions',
        prefilledDate: '2026-11-20',
        todayStr: '2026-11-27'
      })
    ).toEqual({
      nextDate: '2026-11-20',
      shouldConsumePrefilled: true,
      isEnteringAddTab: true
    })
  })

  it('9. resolveAddTabDateChange 應在切入記帳頁且無預填日期時校正為今天', () => {
    expect(
      resolveAddTabDateChange({
        newTab: 'add',
        oldTab: 'dashboard',
        prefilledDate: null,
        todayStr: '2026-11-27'
      })
    ).toEqual({
      nextDate: '2026-11-27',
      shouldConsumePrefilled: false,
      isEnteringAddTab: true
    })
  })

  it('10. resolveAddTabDateChange 在非記帳分頁不應提前消費預填日期', () => {
    expect(
      resolveAddTabDateChange({
        newTab: 'transactions',
        oldTab: 'dashboard',
        prefilledDate: '2026-11-20',
        todayStr: '2026-11-27'
      })
    ).toEqual({
      nextDate: null,
      shouldConsumePrefilled: false,
      isEnteringAddTab: false
    })
  })

  it('11. 合併 watch 模擬：從明細點選特定日期「記一筆」後不應被覆蓋回今天，再次手動切入記帳頁才校正回今天', async () => {
    const activeTab = ref('transactions')
    const addTxPrefilledDate = ref<string | null>(null)
    const dateStr = ref('2026-11-27')
    const todayStr = '2026-11-27'

    const stop = watch(
      [activeTab, addTxPrefilledDate],
      ([newTab, prefilled], oldValues) => {
        const oldTab = oldValues?.[0]
        const { nextDate, shouldConsumePrefilled } = resolveAddTabDateChange({
          newTab,
          oldTab,
          prefilledDate: prefilled,
          todayStr
        })
        if (nextDate) dateStr.value = nextDate
        if (shouldConsumePrefilled) addTxPrefilledDate.value = null
      },
      { immediate: true }
    )

    // 1. 模擬明細頁特定日期按下「記一筆」：先設預填日期，再切換至 add 分頁
    addTxPrefilledDate.value = '2026-11-15'
    activeTab.value = 'add'
    await nextTick()
    await nextTick()

    expect(dateStr.value).toBe('2026-11-15')
    expect(addTxPrefilledDate.value).toBeNull()

    // 2. 離開記帳頁再直接從底部點「記帳」進入（無預填日期）-> 應強制校正回今天
    activeTab.value = 'dashboard'
    await nextTick()
    activeTab.value = 'add'
    await nextTick()

    expect(dateStr.value).toBe(todayStr)

    // 3. 非同步情境：先設預填日期，隔一個 tick 才切換到 add 分頁
    activeTab.value = 'transactions'
    await nextTick()
    addTxPrefilledDate.value = '2026-11-08'
    await nextTick()
    expect(addTxPrefilledDate.value).toBe('2026-11-08')

    activeTab.value = 'add'
    await nextTick()
    await nextTick()
    expect(dateStr.value).toBe('2026-11-08')
    expect(addTxPrefilledDate.value).toBeNull()

    stop()
  })
})
