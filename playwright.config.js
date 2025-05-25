const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  use: {
    actionTimeout: 30000,
    navigationTimeout: 30000,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--js-flags=--expose-gc'  // 启用垃圾回收
      ]
    },
    trace: 'retain-on-failure',
    // 添加视频录制，帮助调试性能问题
    video: 'retain-on-failure',
    // 添加截图配置
    screenshot: 'only-on-failure'
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  workers: 1,  // 性能测试时使用单个worker
  retries: 1,
  // 添加项目特定配置
  projects: [
    {
      name: 'performance',
      testMatch: /performance\.spec\.js/
    }
  ],
  // 添加 webServer 配置
  webServer: {
    command: 'npm run dev',
    port: 5175,
    timeout: 120000, // 增加启动超时时间
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'true'
    }
  }
}); 