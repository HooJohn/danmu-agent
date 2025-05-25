import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 15000,
    testIdAttribute: 'data-testid',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--disable-gpu',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-accelerated-jpeg-decoding',
            '--disable-accelerated-mjpeg-decode',
            '--disable-accelerated-video-decode',
            '--disable-gpu-compositing',
            '--disable-gpu-memory-buffer-video-frames',
            '--disable-gpu-rasterization'
          ]
        }
      },
    },
    /* 暂时注释其他浏览器配置
    {
      name: 'firefox',
      use: { 
        browserName: 'firefox',
        launchOptions: {
          firefoxUserPrefs: {
            'media.autoplay.default': 0,
            'media.volume_scale': 1.0,
            'toolkit.telemetry.enabled': false,
            'browser.cache.disk.enable': false,
            'browser.cache.memory.enable': false,
            'browser.cache.offline.enable': false,
            'network.http.use-cache': false
          }
        }
      },
    },
    {
      name: 'webkit',
      use: { 
        browserName: 'webkit',
        launchOptions: {
          args: ['--disable-gpu']
        }
      },
    },
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        browserName: 'chromium',
        isMobile: true,
        hasTouch: true,
        viewport: { width: 393, height: 851 }
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        browserName: 'webkit',
        isMobile: true,
        hasTouch: true,
        viewport: { width: 390, height: 844 }
      },
    }
    */
  ],

  webServer: {
    command: 'npm run dev',
    port: 5175,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'true'
    }
  }
}); 