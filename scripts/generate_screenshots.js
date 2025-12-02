import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, '../promotional');
const SRC_DIR = path.join(__dirname, '../src');
const POPUP_HTML = `file://${path.join(SRC_DIR, 'ui/popup/index.html')}`;
const OPTIONS_HTML = `file://${path.join(SRC_DIR, 'ui/options/index.html')}`;
const BREAK_HTML = `file://${path.join(SRC_DIR, 'break.html')}`;
const TEMP_DIR = __dirname;

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

function buildFrameHtml({ url, frameWidth, frameHeight, viewportWidth, viewportHeight, background = '#0b1221' }) {
  const padding = 60;
  const scale = Math.min(
    1,
    (viewportWidth - padding * 2) / frameWidth,
    (viewportHeight - padding * 2) / frameHeight
  );
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        :root { color-scheme: light dark; }
        body {
          margin: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.08), transparent 40%),
                      radial-gradient(circle at 80% 0%, rgba(30, 144, 255, 0.1), transparent 35%),
                      ${background};
          box-sizing: border-box;
          padding: ${padding}px;
        }
        .frame {
          width: ${frameWidth}px;
          height: ${frameHeight}px;
          transform: scale(${scale});
          transform-origin: top left;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 22px 50px rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255,255,255,0.08);
          background: ${background};
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="frame">
        <iframe src="${url}"></iframe>
      </div>
    </body>
    </html>
  `;
}
async function generateScreenshots() {
  const browser = await chromium.launch({
    args: ['--disable-web-security'] // Allow file:// CORS
  });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  await context.addInitScript(MOCK_SCRIPT);

  const newPage = async () => context.newPage();

  const captureFramed = async (name, url, selector, measureOpts, background = '#0b1221') => {
    const measurePage = await newPage();
    await measurePage.goto(url);
    await measurePage.waitForSelector(selector);
    const size = await sizeToContent(measurePage, measureOpts);
    await measurePage.close();

    const frameHtml = buildFrameHtml({
      url,
      frameWidth: size.width,
      frameHeight: size.height,
      viewportWidth: 1280,
      viewportHeight: 800,
      background
    });
    const tempPath = path.join(TEMP_DIR, `temp-frame-${name}.html`);
    fs.writeFileSync(tempPath, frameHtml);

    const shotPage = await newPage();
    await shotPage.setViewportSize({ width: 1280, height: 800 });
    await shotPage.goto(`file://${tempPath}`);
    await shotPage.waitForSelector('iframe');
    await shotPage.screenshot({
      path: path.join(OUT_DIR, name),
      clip: { x: 0, y: 0, width: 1280, height: 800 }
    });
    await shotPage.close();
    fs.unlinkSync(tempPath);
  };

  // Screenshots centered in 1280x800 canvases
  await captureFramed('screenshot-popup.png', POPUP_HTML, '.app', { minWidth: 420, maxWidth: 520, minHeight: 620 });
  console.log('Generated screenshot-popup.png');

  await captureFramed('screenshot-popup-promo.png', POPUP_HTML, '.app', { minWidth: 420, maxWidth: 520, minHeight: 620 });
  console.log('Generated screenshot-popup-promo.png');

  await captureFramed('screenshot-options.png', OPTIONS_HTML, '.page', { minWidth: 1040, maxWidth: 1260, minHeight: 900 });
  console.log('Generated screenshot-options.png');

  await captureFramed('screenshot-break.png', BREAK_HTML, '.overlay', { minWidth: 1280, maxWidth: 1400, minHeight: 720 });
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
  await tilePage.close();
  await browser.close();
}

generateScreenshots().catch(console.error);
