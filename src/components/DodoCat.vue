<script setup lang="ts">
import { computed, ref } from 'vue'

// 定義逗逗貓的表情類型
export type CatMood = 'happy' | 'nervous' | 'scared' | 'crying' | 'sleeping'

interface Props {
  mood?: CatMood
  speech?: string
}

const props = withDefaults(defineProps<Props>(), {
  mood: 'happy',
  speech: ''
})

const emit = defineEmits<{
  (e: 'pet'): void
}>()

const isJellyActive = ref(false)

const handlePetClick = () => {
  emit('pet')
  isJellyActive.value = true
  setTimeout(() => {
    isJellyActive.value = false
  }, 300)
}

// 根據表情產生可愛的提示音或貓咪擬聲詞
const catMiau = computed(() => {
  switch (props.mood) {
    case 'happy': return '喵～(❀◕ ▾ ◕)'
    case 'nervous': return '喵嗚…(・_・;)'
    case 'scared': return '喵！∑(O_O;)'
    case 'crying': return '嗚喵(ㄒoㄒ)'
    case 'sleeping': return '呼喵～(ᴗ̤ . ᴗ̤ )'
    default: return '喵～'
  }
})
</script>

<template>
  <div class="dodo-cat-container cat-wiggle">
    <!-- 1. 逗逗貓核心 SVG 圖示 (在左邊) -->
    <div class="cat-svg-wrapper" :class="{ 'cat-jelly-active': isJellyActive }" @click="handlePetClick">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        class="cat-svg"
      >
        <!-- 核心陰影 -->
        <ellipse cx="100" cy="180" rx="60" ry="10" fill="#2C1E1B" opacity="0.1" />

        <!-- 貓身體 (馬卡龍奶油白，粗手繪框) -->
        <path
          d="M 60 180 C 60 110, 140 110, 140 180 Z"
          fill="#FFFDF9"
          stroke="#2C1E1B"
          stroke-width="6"
          stroke-linejoin="round"
        />

        <!-- 貓左右手/爪子 (大圓角，搭在身前) -->
        <g v-if="mood !== 'crying'">
          <ellipse cx="75" cy="165" rx="12" ry="8" fill="#FFFDF9" stroke="#2C1E1B" stroke-width="5" />
          <ellipse cx="125" cy="165" rx="12" ry="8" fill="#FFFDF9" stroke="#2C1E1B" stroke-width="5" />
        </g>

        <!-- 貓耳朵 -->
        <!-- 左耳 -->
        <path
          d="M 60 90 L 40 45 L 85 70 Z"
          fill="#FFFDF9"
          stroke="#2C1E1B"
          stroke-width="6"
          stroke-linejoin="round"
        />
        <path
          d="M 60 85 L 48 53 L 78 72 Z"
          fill="#FFB4B4"
          opacity="0.6"
        />

        <!-- 右耳：nervous 垂耳，scared 豎起，一般正常 -->
        <path
          v-if="mood === 'nervous'"
          d="M 140 90 L 160 110 L 115 70 Z"
          fill="#FFFDF9"
          stroke="#2C1E1B"
          stroke-width="6"
          stroke-linejoin="round"
        />
        <path
          v-else
          d="M 140 90 L 160 45 L 115 70 Z"
          fill="#FFFDF9"
          stroke="#2C1E1B"
          stroke-width="6"
          stroke-linejoin="round"
        />
        <path
          v-if="mood !== 'nervous'"
          d="M 140 85 L 152 53 L 122 72 Z"
          fill="#FFB4B4"
          opacity="0.6"
        />

        <!-- 薰衣草領圈 (戴在大頭下巴邊緣下方，位於頭部主體下方、身體上方，呈現完美的項圈空間環繞層次) -->
        <path
          d="M 56 132 Q 100 164 144 132"
          fill="none"
          stroke="#2C1E1B"
          stroke-width="12"
          stroke-linecap="round"
        />
        <path
          d="M 56 132 Q 100 164 144 132"
          fill="none"
          stroke="#C3B1E1"
          stroke-width="6"
          stroke-linecap="round"
        />
        <!-- 領圈黃金鈴鐺 (完美垂掛在下巴最下緣胸前) -->
        <circle cx="100" cy="162" r="6.5" fill="#F4C842" stroke="#2C1E1B" stroke-width="2.5" />
        <line x1="93.5" y1="159.5" x2="106.5" y2="159.5" stroke="#2C1E1B" stroke-width="1.8" />
        <circle cx="100" cy="165.5" r="1.8" fill="#2C1E1B" />

        <!-- 貓頭部 -->
        <ellipse
          cx="100"
          cy="110"
          rx="52"
          ry="44"
          fill="#FFFDF9"
          stroke="#2C1E1B"
          stroke-width="6"
        />

        <!-- 貓腮紅 (軟萌粉紅) -->
        <ellipse cx="65" cy="122" rx="8" ry="5" fill="#FFB4B4" opacity="0.6" />
        <ellipse cx="135" cy="122" rx="8" ry="5" fill="#FFB4B4" opacity="0.6" />

        <!-- ─── 表情包切換 ─── -->

        <!-- 1. 開心表情 (happy) -->
        <g v-if="mood === 'happy'">
          <!-- 瞇瞇眼 -->
          <path d="M 70 105 Q 78 98 85 105" fill="none" stroke="#2C1E1B" stroke-width="5" stroke-linecap="round" />
          <path d="M 115 105 Q 122 98 130 105" fill="none" stroke="#2C1E1B" stroke-width="5" stroke-linecap="round" />
          <!-- 貓咪小嘴巴 (W 形) -->
          <path d="M 94 118 Q 100 124 100 118 Q 100 124 106 118" fill="none" stroke="#2C1E1B" stroke-width="5" stroke-linecap="round" />
        </g>

        <!-- 2. 小緊張表情 (nervous) -->
        <g v-if="mood === 'nervous'">
          <!-- 尷尬小眼神 -->
          <ellipse cx="78" cy="106" rx="4" ry="6" fill="#2C1E1B" />
          <ellipse cx="122" cy="106" rx="4" ry="6" fill="#2C1E1B" />
          <path d="M 72 96 Q 78 93 84 96" fill="none" stroke="#2C1E1B" stroke-width="3" stroke-linecap="round" />
          <!-- 平平的嘴巴 -->
          <line x1="94" y1="120" x2="106" y2="120" stroke="#2C1E1B" stroke-width="4.5" stroke-linecap="round" />
        </g>

        <!-- 3. 驚嚇流汗表情 (scared) -->
        <g v-if="mood === 'scared'">
          <!-- 圓滾滾的大眼 -->
          <circle cx="76" cy="106" r="9" fill="#FFFFFF" stroke="#2C1E1B" stroke-width="4.5" />
          <circle cx="76" cy="106" r="4" fill="#2C1E1B" />
          <circle cx="124" cy="106" r="9" fill="#FFFFFF" stroke="#2C1E1B" stroke-width="4.5" />
          <circle cx="124" cy="106" r="4" fill="#2C1E1B" />
          <!-- 八字眉 -->
          <path d="M 68 93 Q 76 97 82 92" fill="none" stroke="#2C1E1B" stroke-width="3.5" stroke-linecap="round" />
          <path d="M 132 93 Q 124 97 118 92" fill="none" stroke="#2C1E1B" stroke-width="3.5" stroke-linecap="round" />
          <!-- 圓嘴巴 -->
          <circle cx="100" cy="122" r="6" fill="#FFB4B4" stroke="#2C1E1B" stroke-width="4.5" />
          <!-- 藍色流汗滴 (動態) -->
          <path
            d="M 148 95 C 148 90, 154 90, 154 95 C 154 100, 148 100, 148 95"
            fill="#A9C9FF"
            stroke="#2C1E1B"
            stroke-width="2.5"
            class="sweat-drop"
          />
        </g>

        <!-- 4. 遮眼大哭表情 (crying) -->
        <g v-if="mood === 'crying'">
          <!-- 貓爪子擋住眼睛 -->
          <path d="M 60 115 Q 75 92 82 115" fill="#FFFDF9" stroke="#2C1E1B" stroke-width="5" stroke-linejoin="round" />
          <path d="M 140 115 Q 125 92 118 115" fill="#FFFDF9" stroke="#2C1E1B" stroke-width="5" stroke-linejoin="round" />
          <!-- 下垂的哭嘴巴 -->
          <path d="M 94 125 Q 100 118 106 125" fill="none" stroke="#2C1E1B" stroke-width="5" stroke-linecap="round" />
          <!-- 流淚線 -->
          <path d="M 72 116 L 72 135" stroke="#A9C9FF" stroke-width="4" stroke-linecap="round" />
          <path d="M 128 116 L 128 135" stroke="#A9C9FF" stroke-width="4" stroke-linecap="round" />
        </g>

        <!-- 5. 睡覺/伸懶腰 (sleeping) -->
        <g v-if="mood === 'sleeping'">
          <!-- 安詳閉眼 -->
          <path d="M 70 107 Q 78 112 85 107" fill="none" stroke="#2C1E1B" stroke-width="4.5" stroke-linecap="round" />
          <path d="M 115 107 Q 122 112 130 107" fill="none" stroke="#2C1E1B" stroke-width="4.5" stroke-linecap="round" />
          <!-- W 嘴巴 -->
          <path d="M 95 118 Q 100 122 100 118 Q 100 122 105 118" fill="none" stroke="#2C1E1B" stroke-width="4.5" stroke-linecap="round" />
        </g>

        <!-- 貓鼻子 (倒三角) -->
        <polygon v-if="mood !== 'crying'" points="96,112 104,112 100,116" fill="#2C1E1B" />

        <!-- 貓鬍鬚 (可愛短線) -->
        <line x1="38" y1="112" x2="22" y2="108" stroke="#2C1E1B" stroke-width="4" stroke-linecap="round" />
        <line x1="38" y1="122" x2="24" y2="124" stroke="#2C1E1B" stroke-width="4" stroke-linecap="round" />
        <line x1="162" y1="112" x2="178" y2="108" stroke="#2C1E1B" stroke-width="4" stroke-linecap="round" />
        <line x1="162" y1="122" x2="176" y2="124" stroke="#2C1E1B" stroke-width="4" stroke-linecap="round" />

        <!-- 額頭虎斑紋 (可愛花紋) -->
        <path d="M 94 67 L 94 77" stroke="#2C1E1B" stroke-width="4.5" stroke-linecap="round" />
        <path d="M 100 67 L 100 80" stroke="#2C1E1B" stroke-width="4.5" stroke-linecap="round" />
        <path d="M 106 67 L 106 77" stroke="#2C1E1B" stroke-width="4.5" stroke-linecap="round" />
      </svg>

      <!-- 逗逗貓的小道具：玩毛線球 (僅在 happy 時顯示，固定在貓咪左下角) -->
      <Transition name="bubble-fade">
        <div v-if="mood === 'happy'" class="yarn-ball-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" class="yarn-svg">
            <circle cx="20" cy="20" r="14" fill="#FFB4B4" stroke="#2C1E1B" stroke-width="3" />
            <path d="M 12 12 Q 20 22 28 28" fill="none" stroke="#2C1E1B" stroke-width="2.5" />
            <path d="M 10 24 Q 22 18 30 10" fill="none" stroke="#2C1E1B" stroke-width="2.5" />
            <path d="M 20 6 Q 14 20 22 34" fill="none" stroke="#2C1E1B" stroke-width="2.5" />
            <!-- 散落的毛線頭 -->
            <path d="M 30 30 C 35 32, 28 38, 36 38" fill="none" stroke="#2C1E1B" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
      </Transition>
    </div>

    <!-- 2. 可愛手繪風對話泡泡 (Speech Bubble) (在右邊) -->
    <Transition name="bubble-fade">
      <div v-if="speech" class="speech-bubble pop-jelly">
        <p class="speech-text">{{ speech }}</p>
        <p class="cat-signature">{{ catMiau }}</p>
        <div class="speech-arrow"></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dodo-cat-container {
  display: flex;
  flex-direction: row; /* 水平排列：貓在左，氣泡在右 */
  align-items: flex-end; /* 底部對齊 */
  justify-content: center; /* 在大卡片內整體居中 */
  gap: 20px; /* 貓咪與氣泡的水平安全間距，絕不重疊 */
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: 24px; /* 留出底部給貓咪陰影與毛線球 */
  box-sizing: border-box;
}

.cat-svg-wrapper {
  width: 140px;
  height: 140px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  position: relative;
  z-index: 10;
  cursor: pointer;
  flex-shrink: 0; /* 防止貓咪被擠壓變形 */
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.cat-svg-wrapper:hover {
  transform: scale(1.05);
}

.cat-jelly-active {
  animation: catJellyPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes catJellyPop {
  0% { transform: scale(1); }
  35% { transform: scale(0.82, 1.25); }
  65% { transform: scale(1.18, 0.82); }
  100% { transform: scale(1); }
}

.cat-svg {
  width: 100%;
  height: 100%;
}

/* 療癒毛線球擺放 (完美靠在貓咪左下角) */
.yarn-ball-container {
  position: absolute;
  bottom: -4px;
  left: -12px;
  width: 36px;
  height: 36px;
  z-index: 15;
  animation: ballRotate 4s ease-in-out infinite;
}

@keyframes ballRotate {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  50% { transform: rotate(15deg) translateY(-2px); }
}

/* 藍色流汗滴動畫 */
@keyframes sweatAnim {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(2px) scale(0.9); }
}
.sweat-drop {
  animation: sweatAnim 1.5s ease-in-out infinite;
  transform-origin: center;
}

/* 手繪對話泡泡樣式 (方案 B: 側邊漫畫旁白氣泡) */
.speech-bubble {
  position: relative; /* 改為相對定位，成為 Flex item */
  margin-bottom: 48px; /* 向上提，精準避開底部的餵食互動按鈕 */
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: 18px;
  padding: 10px 14px;
  flex: 1; /* 彈性寬度 */
  max-width: 180px; /* 限制最大寬度，在大螢幕也精緻 */
  min-width: 120px; /* 限制最小寬度，在小螢幕也能正常顯示 */
  box-shadow: var(--shadow-jelly-sm);
  z-index: 20;
  word-wrap: break-word;
}

.speech-text {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text-dark);
}

.cat-signature {
  font-size: 11px;
  font-weight: 800;
  text-align: right;
  margin-top: 4px;
  color: var(--color-text-muted);
}

/* 泡泡指引三角形線框 (指向左側貓咪) */
.speech-arrow {
  position: absolute;
  left: -11px;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 16px;
  background-color: #FFFFFF;
}

.speech-arrow::before,
.speech-arrow::after {
  content: '';
  position: absolute;
  border-style: solid;
}

.speech-arrow::before {
  border-width: 8px 8px 8px 0;
  border-color: transparent var(--color-border) transparent transparent;
  left: -2.5px;
  top: -3px;
}

.speech-arrow::after {
  border-width: 5px 5px 5px 0;
  border-color: transparent #FFFFFF transparent transparent;
  left: 0;
  top: 0;
}

/* 對話框過渡動畫 */
.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.bubble-fade-enter-from {
  opacity: 0;
  transform: scale(0.8) translateX(10px);
}

.bubble-fade-leave-to {
  opacity: 0;
  transform: scale(0.9) translateX(5px);
}
</style>
