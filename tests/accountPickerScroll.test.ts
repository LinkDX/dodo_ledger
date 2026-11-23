import { describe, it, expect } from 'vitest'
import { computeCenteredScrollLeft } from '../src/utils/scroll'

describe('🎯 帳戶選取器橫向置中捲動計算 (src/utils/scroll.ts)', () => {
  it('1. 容器隱藏 (clientWidth = 0) 或目標卡片寬度為 0 時應回傳 null，避免覆蓋捲動位置', () => {
    expect(
      computeCenteredScrollLeft({
        containerClientWidth: 0,
        containerScrollWidth: 600,
        containerOffsetLeft: 12,
        targetOffsetLeft: 320,
        targetOffsetWidth: 95,
        isContainerOffsetParent: true
      })
    ).toBeNull()

    expect(
      computeCenteredScrollLeft({
        containerClientWidth: 360,
        containerScrollWidth: 600,
        containerOffsetLeft: 0,
        targetOffsetLeft: 320,
        targetOffsetWidth: 0,
        isContainerOffsetParent: true
      })
    ).toBeNull()
  })

  it('2. 中間卡片應精準置中於容器視窗', () => {
    // 容器寬 360，卡片位於 offsetLeft = 300、寬 100 -> 卡片中心 350，期望 scrollLeft = 350 - 180 = 170
    const result = computeCenteredScrollLeft({
      containerClientWidth: 360,
      containerScrollWidth: 900,
      containerOffsetLeft: 16,
      targetOffsetLeft: 300,
      targetOffsetWidth: 100,
      isContainerOffsetParent: true
    })
    expect(result).toBe(170)
  })

  it('3. 首張卡片應夾限為 0，不可出現負值', () => {
    const result = computeCenteredScrollLeft({
      containerClientWidth: 360,
      containerScrollWidth: 900,
      containerOffsetLeft: 0,
      targetOffsetLeft: 4,
      targetOffsetWidth: 95,
      isContainerOffsetParent: true
    })
    expect(result).toBe(0)
  })

  it('4. 末張卡片不可超過最大可捲動距離 (scrollWidth - clientWidth)', () => {
    // maxScrollLeft = 900 - 360 = 540；原始計算 796 + 47.5 - 180 = 663.5 -> 夾限為 540
    const result = computeCenteredScrollLeft({
      containerClientWidth: 360,
      containerScrollWidth: 900,
      containerOffsetLeft: 0,
      targetOffsetLeft: 796,
      targetOffsetWidth: 95,
      isContainerOffsetParent: true
    })
    expect(result).toBe(540)
  })

  it('5. 卡片總寬度未超過容器 (無須橫向捲動) 時應回傳 0', () => {
    const result = computeCenteredScrollLeft({
      containerClientWidth: 360,
      containerScrollWidth: 300,
      containerOffsetLeft: 0,
      targetOffsetLeft: 200,
      targetOffsetWidth: 95,
      isContainerOffsetParent: true
    })
    expect(result).toBe(0)
  })

  it('6. 當容器非目標的 offsetParent 時，應扣除 containerOffsetLeft 計算相對位移', () => {
    // 容器位於 offsetLeft = 24，卡片 offsetLeft = 324 -> 相對位置為 300，置中計算 300 - 180 + 50 = 170
    const result = computeCenteredScrollLeft({
      containerClientWidth: 360,
      containerScrollWidth: 900,
      containerOffsetLeft: 24,
      targetOffsetLeft: 324,
      targetOffsetWidth: 100,
      isContainerOffsetParent: false
    })
    expect(result).toBe(170)
  })
})
