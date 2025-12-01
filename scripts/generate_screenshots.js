const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../promotional');
const SRC_DIR = path.join(__dirname, '../src');
const POPUP_HTML = `file://${path.join(SRC_DIR, 'popup/index.html')}`;
const OPTIONS_HTML = `file://${path.join(SRC_DIR, 'options/index.html')}`;
const BREAK_HTML = `file://${path.join(SRC_DIR, 'break.html')}`;

const MOCK_STATE = {
  timer: {
    methodKey: 'pomodoro',
    phase: 'work',
    isRunning: true,
    startTime: Date.now(),
    endTime: Date.now() + 25 * 60 * 1000,
    remainingMs: 25 * 60 * 1000,
    cycleCount: 1,
    completedSessions: 2,
    activeTaskId: '1'
  },
  tasks: [
    { id: '1', title: 'Design new icons', estimate: 4, completedSessions: 2, done: false },
    { id: '2', title: 'Update manifest', estimate: 1, completedSessions: 0, done: false }
  ],
  history: [
    { methodKey: 'pomodoro', phase: 'work', durationMs: 25*60*1000, endedAt: Date.now() - 3600000 },
    { methodKey: 'pomodoro', phase: 'break', durationMs: 5*60*1000, endedAt: Date.now() - 3000000 }
  ]
};

const MOCK_SETTINGS = {
  selectedMethod: 'pomodoro',
  presets: {
    pomodoro: { label: 'Pomodoro', workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLongBreak: 4 },
    flowtime: { label: 'Flowtime', flexible: true }
  },
  autoStartBreaks: true,
  autoStartWork: true,
  lockIn: false,
  notifications: true,
  sound: 'chime',
  volume: 0.7,
  breakEnforcement: false,
  badge: true,
  theme: 'aurora'
};

const MOCK_SCRIPT = `
  window.chrome = {
    runtime: {
      sendMessage: (msg) => {
        if (msg.type === 'getState') {
          return Promise.resolve({
            state: ${JSON.stringify(MOCK_STATE)},
            settings: ${JSON.stringify(MOCK_SETTINGS)},
            methods: ${JSON.stringify(MOCK_SETTINGS.presets)},
            remaining: ${MOCK_STATE.timer.remainingMs}
          });
        }
        return Promise.resolve({});
      },
      onMessage: { addListener: () => {} },
      getURL: (path) => path
    },
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve({})
      }
    },
    action: {
      setBadgeText: () => {},
      setBadgeBackgroundColor: () => {}
    }
  };
`;

async function sizeToContent(page, { minWidth = 400, maxWidth = 900, minHeight = 400 } = {}) {
  const { width, height } = await page.evaluate(() => ({
    width: Math.ceil(document.documentElement.scrollWidth),
    height: Math.ceil(document.documentElement.scrollHeight)
  }));
  const finalWidth = Math.min(maxWidth, Math.max(minWidth, width));
  const finalHeight = Math.max(minHeight, height);
  await page.setViewportSize({ width: finalWidth, height: finalHeight });
  return { width: finalWidth, height: finalHeight };
}

async function generateScreenshots() {
  const browser = await chromium.launch({
    args: ['--disable-web-security'] // Allow file:// CORS
  });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  await context.addInitScript(MOCK_SCRIPT);

  const newPage = async () => context.newPage();

  // 1. Popup Screenshot
  const popupPage = await newPage();
  await popupPage.goto(POPUP_HTML);
  await popupPage.waitForSelector('.app');
  const popupSize = await sizeToContent(popupPage, { minWidth: 420, maxWidth: 520, minHeight: 620 });
  await popupPage.screenshot({ path: path.join(OUT_DIR, 'screenshot-popup.png') });
  console.log('Generated screenshot-popup.png');

  // 1b. Popup Promo Screenshot (1280x800)
  // Wrapper page that centers the popup at its actual dimensions
  const popupPromoHtml = `
      <!DOCTYPE html>
      <html>
      <head>
      <style>
        body {
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 50%, #1e293b, #0f172a);
          height: 100vh;
          width: 100vw;
        }
        .frame {
          width: ${popupSize.width}px;
          height: ${popupSize.height}px;
          border: 1px solid #334155;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          background: #0b1221; /* Match popup bg */
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      </style>
    </head>
    <body>
      <div class="frame">
        <iframe src="../src/popup/index.html"></iframe>
        </div>
      </body>
      </html>
  `;
  const popupPromoPath = path.join(__dirname, 'temp-popup-promo.html');
  fs.writeFileSync(popupPromoPath, popupPromoHtml);
  
  const promoPage = await newPage();
  await promoPage.goto(`file://${popupPromoPath}`);
  await promoPage.setViewportSize({ width: 1280, height: 800 });
  await promoPage.waitForSelector('iframe');
  await promoPage.screenshot({ path: path.join(OUT_DIR, 'screenshot-popup-promo.png') });
  console.log('Generated screenshot-popup-promo.png');
  fs.unlinkSync(popupPromoPath);

  // 2. Options Screenshot
  const optionsPage = await newPage();
  await optionsPage.goto(OPTIONS_HTML);
  await optionsPage.waitForSelector('.page');
  await sizeToContent(optionsPage, { minWidth: 1040, maxWidth: 1260, minHeight: 900 });
  await optionsPage.screenshot({ path: path.join(OUT_DIR, 'screenshot-options.png') });
  console.log('Generated screenshot-options.png');

  // 3. Break Screenshot
  const breakPage = await newPage();
  await breakPage.goto(BREAK_HTML);
  await breakPage.waitForSelector('.overlay');
  await sizeToContent(breakPage, { minWidth: 1280, maxWidth: 1400, minHeight: 720 });
  await breakPage.screenshot({ path: path.join(OUT_DIR, 'screenshot-break.png') });
  console.log('Generated screenshot-break.png');

  // 4. Generate Tiles (Small & Large) & Logo
  // We'll create a temporary HTML file for this
  const tileHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-sizing: border-box;
          padding: 24px;
          background: radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.1), transparent 40%),
                      radial-gradient(circle at 80% 0%, rgba(30, 144, 255, 0.12), transparent 35%),
                      #0b1221;
          color: #e8ecf5;
          font-family: "Segoe UI", system-ui, sans-serif;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }
        .logo {
          width: 130px;
          height: 130px;
          margin-bottom: 12px;
        }
        h1 {
          font-size: 44px;
          margin: 0;
          background: linear-gradient(135deg, #4facfe, #00f2fe);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          font-size: 22px;
          color: #9aa7c2;
          margin: 6px 0 0;
        }
        /* Large tile adjustments */
        .large .logo { width: 220px; height: 220px; }
        .large h1 { font-size: 68px; }
        .large p { font-size: 28px; }
        
        /* Logo only */
        .logo-only .logo { width: 280px; height: 280px; margin: 0; }
      </style>
    </head>
    <body>
      <img src="../src/assets/icon.svg" class="logo">
      <h1>FlexiFocus</h1>
      <p>Master your time</p>
    </body>
    </html>
  `;
  
  const tilePath = path.join(__dirname, 'temp-tile.html');
  fs.writeFileSync(tilePath, tileHtml);

  // Small Tile (440x280)
  const tilePage = await newPage();
  await tilePage.goto(`file://${tilePath}`);
  await tilePage.setViewportSize({ width: 440, height: 280 });
  await tilePage.screenshot({ path: path.join(OUT_DIR, 'store-tile-small.png') });
  console.log('Generated store-tile-small.png');

  // Large Tile (1400x560)
  await tilePage.evaluate(() => document.body.classList.add('large'));
  await tilePage.setViewportSize({ width: 1400, height: 560 });
  await tilePage.screenshot({ path: path.join(OUT_DIR, 'store-tile-large.png') });
  console.log('Generated store-tile-large.png');

  // Store Logo (300x300)
  // We'll just render the icon large on a transparent or matching background
  const logoHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; display:grid; place-items:center; height:100vh; background:transparent;">
      <img src="../src/assets/icon.svg" style="width:300px; height:300px;">
    </body>
    </html>
  `;
  fs.writeFileSync(tilePath, logoHtml);
  await tilePage.goto(`file://${tilePath}`);
  await tilePage.setViewportSize({ width: 300, height: 300 });
  // Take screenshot with transparency if possible, but store usually wants JPG/PNG. 
  // Edge asks for 300x300.
  await tilePage.screenshot({ path: path.join(OUT_DIR, 'store-logo.png'), omitBackground: true });
  console.log('Generated store-logo.png');

  // Cleanup
  fs.unlinkSync(tilePath);
  await popupPage.close();
  await promoPage.close();
  await optionsPage.close();
  await breakPage.close();
  await tilePage.close();
  await browser.close();
}

generateScreenshots().catch(console.error);
