const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../promotional');
const SRC_DIR = path.join(__dirname, '../src');

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

async function generateScreenshots() {
  const browser = await chromium.launch({
    args: ['--disable-web-security'] // Allow file:// CORS
  });
  const context = await browser.newContext({
    deviceScaleFactor: 2
  });

  // 1. Popup Screenshot
  const page = await context.newPage();
  await page.addInitScript(MOCK_SCRIPT);
  await page.goto(`file://${path.join(SRC_DIR, 'popup/popup.html')}`);
  
  // Wait for render
  await page.waitForTimeout(1000);
  
  // Resize viewport to fit popup content nicely
  await page.setViewportSize({ width: 400, height: 600 });
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-popup.png') });
  console.log('Generated screenshot-popup.png');

  // 1b. Popup Promo Screenshot (1280x800)
  // We create a wrapper page to center the popup on a background
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
          width: 380px;
          height: 600px;
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
        <iframe src="../src/popup/popup.html"></iframe>
      </div>
    </body>
    </html>
  `;
  const popupPromoPath = path.join(__dirname, 'temp-popup-promo.html');
  fs.writeFileSync(popupPromoPath, popupPromoHtml);
  
  await page.goto(`file://${popupPromoPath}`);
  // We need to inject the mock into the iframe too, but Playwright's addInitScript works on frames too usually.
  // However, since we are navigating to a new page that contains an iframe, we might need to ensure the iframe gets the mock.
  // The easiest way is to just use the page we already have and style the body to center the content, 
  // but popup.js might rely on window size.
  // Let's try the iframe approach. We need to wait for the iframe to load.
  await page.waitForTimeout(2000);
  
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-popup-promo.png') });
  console.log('Generated screenshot-popup-promo.png');
  fs.unlinkSync(popupPromoPath);

  // 2. Options Screenshot
  await page.goto(`file://${path.join(SRC_DIR, 'options/options.html')}`);
  await page.waitForTimeout(1000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-options.png') });
  console.log('Generated screenshot-options.png');

  // 3. Break Screenshot
  await page.goto(`file://${path.join(SRC_DIR, 'break.html')}`);
  await page.waitForTimeout(1000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot-break.png') });
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
          width: 150px;
          height: 150px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 48px;
          margin: 0;
          background: linear-gradient(135deg, #4facfe, #00f2fe);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          font-size: 24px;
          color: #9aa7c2;
          margin-top: 10px;
        }
        /* Large tile adjustments */
        .large .logo { width: 250px; height: 250px; }
        .large h1 { font-size: 80px; }
        .large p { font-size: 32px; }
        
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
  await page.goto(`file://${tilePath}`);
  await page.setViewportSize({ width: 440, height: 280 });
  await page.screenshot({ path: path.join(OUT_DIR, 'store-tile-small.png') });
  console.log('Generated store-tile-small.png');

  // Large Tile (1400x560)
  await page.evaluate(() => document.body.classList.add('large'));
  await page.setViewportSize({ width: 1400, height: 560 });
  await page.screenshot({ path: path.join(OUT_DIR, 'store-tile-large.png') });
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
  await page.goto(`file://${tilePath}`);
  await page.setViewportSize({ width: 300, height: 300 });
  // Take screenshot with transparency if possible, but store usually wants JPG/PNG. 
  // Edge asks for 300x300.
  await page.screenshot({ path: path.join(OUT_DIR, 'store-logo.png'), omitBackground: true });
  console.log('Generated store-logo.png');

  // Cleanup
  fs.unlinkSync(tilePath);
  await browser.close();
}

generateScreenshots().catch(console.error);
