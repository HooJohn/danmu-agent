// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false, // 禁用并行执行以避免资源竞争
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // 本地也允许一次重试
  workers: process.env.CI ? 1 : 1, // 限制worker数量
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['list'] // 添加列表报告器以获得更好的控制台输出
  ],
  globalSetup: require.resolve('./test-setup.js'),
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'retain-on-failure', // 仅在失败时保留跟踪
    video: 'retain-on-failure', // 仅在失败时保留视频
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000, // 增加动作超时时间
    navigationTimeout: 15000, // 增加导航超时时间
    testIdAttribute: 'data-testid', // 使用data-testid作为测试ID
    
    // 添加自定义属性
    extraHTTPHeaders: {
      'Test-Run-ID': `test-${Date.now()}`,
    },
  },

  /* 配置不同的项目测试 */
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
        // 移动端 Chrome 特定设置
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
        // 移动端 Safari 特定设置
        isMobile: true,
        hasTouch: true,
        viewport: { width: 390, height: 844 }
      },
    },
    // 添加旧版浏览器测试
    {
      name: 'chrome-old',
      use: { 
        browserName: 'chromium',
        channel: 'chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
      },
    }
  ],

  // 添加 webServer 配置
  webServer: {
    command: 'npm run dev',
    port: 5173,
    timeout: 120000, // 增加启动超时时间
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'true'
    }
  }
}); 