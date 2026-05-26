#!/usr/bin/env node
/**
 * Dodo Ledger - Splash Screen 批次生成腳本
 * 產生逗逗貓品牌啟動畫面，覆蓋 Android 各密度/方向的 splash.png
 */

const sharp = require('sharp');
const path = require('path');

const ICON_PATH = path.join(__dirname, '../public/dodo-icon.svg');
const RES_BASE = path.join(__dirname, '../android/app/src/main/res');

// 品牌背景色（奶油黃）
const BG_COLOR = { r: 255, g: 248, b: 236, alpha: 1 };

// 各方向各密度的 Splash 尺寸規格
const SPLASH_SPECS = [
  // Portrait（直向）
  { dir: 'drawable-port-mdpi',    w: 320,  h: 480  },
  { dir: 'drawable-port-hdpi',    w: 480,  h: 800  },
  { dir: 'drawable-port-xhdpi',   w: 720,  h: 1280 },
  { dir: 'drawable-port-xxhdpi',  w: 960,  h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  // Landscape（橫向）
  { dir: 'drawable-land-mdpi',    w: 480,  h: 320  },
  { dir: 'drawable-land-hdpi',    w: 800,  h: 480  },
  { dir: 'drawable-land-xhdpi',   w: 1280, h: 720  },
  { dir: 'drawable-land-xxhdpi',  w: 1600, h: 960  },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  // 預設 drawable（低密度備援）
  { dir: 'drawable',              w: 480,  h: 320  },
];

async function generateSplash(spec) {
  const { dir, w, h } = spec;
  const outFile = path.join(RES_BASE, dir, 'splash.png');

  // 決定 Logo 尺寸：取短邊的 40% 作為 Logo 大小（視覺平衡）
  const shortEdge = Math.min(w, h);
  const logoSize = Math.round(shortEdge * 0.40);

  // 以品牌背景色建立底板，並將 Logo 置中合成
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: BG_COLOR,
    }
  })
  .composite([
    {
      input: await sharp(ICON_PATH)
        .resize(logoSize, logoSize)
        .png()
        .toBuffer(),
      gravity: 'center',
    }
  ])
  .png()
  .toFile(outFile);

  console.log(`✅ ${dir.padEnd(28)} (${w}x${h}px, logo=${logoSize}px)`);
}

async function main() {
  console.log('🐱 Dodo Ledger Splash Screen 生成工具啟動...\n');

  for (const spec of SPLASH_SPECS) {
    await generateSplash(spec);
  }

  console.log('\n🎉 所有 Splash Screen 生成完成！');
  console.log('📁 輸出位置：android/app/src/main/res/drawable-{port,land}-*/splash.png');
}

main().catch(err => {
  console.error('❌ Splash 生成失敗：', err.message);
  process.exit(1);
});
