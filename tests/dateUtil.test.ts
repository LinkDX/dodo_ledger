import { describe, it, expect } from 'vitest'
import {
  formatLocalDate,
  getTodayLocalDateString,
  getYesterdayLocalDateString,
  isDateToday,
  parseLocalDateToTimestamp
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
})
