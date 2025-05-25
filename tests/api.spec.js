const { test, expect } = require('@playwright/test');

// 全局配置
test.use({
  // 增加导航超时时间
  navigationTimeout: 30000,
  // 增加页面加载超时时间
  actionTimeout: 30000,
});

test.describe('API 集成测试', () => {
  let context;
  let page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    
    // 增加重试机制
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto('http://localhost:5175', { timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          await context.close();
          throw error;
        }
        // 等待 2 秒后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('WebSocket 连接测试', async () => {
    // 确保WebSocket已连接
    await page.waitForFunction(() => window.socket && window.socket.connected, { timeout: 10000 });
    
    // 验证WebSocket状态
    const isConnected = await page.evaluate(() => {
      return window.socket.connected;
    });
    expect(isConnected).toBeTruthy();
    
    // 验证WebSocket URL
    const wsUrl = await page.evaluate(() => {
      return window.socket.io.uri;
    });
    expect(wsUrl).toContain('ws://');
  });

  test('弹幕发送 API 测试', async () => {
    // 监听网络请求
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/danmu') && 
      response.request().method() === 'POST'
    );

    // 发送弹幕
    await page.fill('input[type="text"]', 'API测试弹幕');
    await page.click('button[type="submit"]');

    // 等待响应
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const responseData = await response.json();
    expect(responseData).toHaveProperty('success', true);
  });

  test('弹幕历史记录 API 测试', async () => {
    // 监听历史记录请求
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/history') && 
      response.request().method() === 'GET'
    );

    // 触发历史记录加载
    await page.click('.history-button'); // 假设有一个历史记录按钮

    // 等待响应
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    
    const history = await response.json();
    expect(Array.isArray(history)).toBeTruthy();
  });

  test('错误处理测试', async () => {
    // 模拟网络错误
    await page.route('**/api/danmu', route => {
      route.abort('failed');
    });

    // 发送弹幕
    await page.fill('input[type="text"]', '错误测试弹幕');
    await page.click('button[type="submit"]');

    // 验证错误提示是否显示
    const errorMessage = await page.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('发送失败');
  });

  test('重连机制测试', async () => {
    // 断开 WebSocket 连接
    await page.evaluate(() => {
      window.socket.disconnect();
    });

    // 等待重连
    await page.waitForTimeout(1000);

    // 验证是否自动重连
    const isReconnected = await page.evaluate(() => {
      return window.socket.connected;
    });
    expect(isReconnected).toBeTruthy();
  });

  test('消息限流测试', async () => {
    // 快速发送多条消息
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="text"]', `限流测试 ${i}`);
      await page.click('button[type="submit"]');
    }

    // 验证是否出现限流提示
    const rateLimit = await page.locator('.rate-limit-message');
    await expect(rateLimit).toBeVisible();
    await expect(rateLimit).toContainText('发送过于频繁');
  });
});
