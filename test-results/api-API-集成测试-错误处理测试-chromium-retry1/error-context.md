# Test info

- Name: API 集成测试 >> 错误处理测试
- Location: /Users/mc/Desktop/Danmu-Agent/tests/api.spec.js:96:3

# Error details

```
Error: page.fill: Target page, context or browser has been closed
Call log:
  - waiting for locator('input[type="text"]')

    at /Users/mc/Desktop/Danmu-Agent/tests/api.spec.js:103:16
```

# Page snapshot

```yaml
- banner:
  - heading "弹幕助手" [level=1]
  - button "语音开关"
  - button "设置"
- main:
  - combobox:
    - option "默认音色" [selected]
  - slider: "50"
- contentinfo: "未连接 消息数: 0"
```

# Test source

```ts
   3 | // 全局配置
   4 | test.use({
   5 |   // 增加导航超时时间
   6 |   navigationTimeout: 30000,
   7 |   // 增加页面加载超时时间
   8 |   actionTimeout: 30000,
   9 | });
   10 |
   11 | test.describe('API 集成测试', () => {
   12 |   let context;
   13 |   let page;
   14 |
   15 |   test.beforeEach(async ({ browser }) => {
   16 |     context = await browser.newContext();
   17 |     page = await context.newPage();
   18 |     
   19 |     // 增加重试机制
   20 |     let retries = 3;
   21 |     while (retries > 0) {
   22 |       try {
   23 |         await page.goto('http://localhost:5175', { timeout: 30000 });
   24 |         await page.waitForLoadState('networkidle', { timeout: 30000 });
   25 |         break;
   26 |       } catch (error) {
   27 |         retries--;
   28 |         if (retries === 0) {
   29 |           await context.close();
   30 |           throw error;
   31 |         }
   32 |         // 等待 2 秒后重试
   33 |         await new Promise(resolve => setTimeout(resolve, 2000));
   34 |       }
   35 |     }
   36 |   });
   37 |
   38 |   test.afterEach(async () => {
   39 |     await context.close();
   40 |   });
   41 |
   42 |   test('WebSocket 连接测试', async () => {
   43 |     // 确保WebSocket已连接
   44 |     await page.waitForFunction(() => window.socket && window.socket.connected, { timeout: 10000 });
   45 |     
   46 |     // 验证WebSocket状态
   47 |     const isConnected = await page.evaluate(() => {
   48 |       return window.socket.connected;
   49 |     });
   50 |     expect(isConnected).toBeTruthy();
   51 |     
   52 |     // 验证WebSocket URL
   53 |     const wsUrl = await page.evaluate(() => {
   54 |       return window.socket.io.uri;
   55 |     });
   56 |     expect(wsUrl).toContain('ws://');
   57 |   });
   58 |
   59 |   test('弹幕发送 API 测试', async () => {
   60 |     // 监听网络请求
   61 |     const responsePromise = page.waitForResponse(response => 
   62 |       response.url().includes('/api/danmu') && 
   63 |       response.request().method() === 'POST'
   64 |     );
   65 |
   66 |     // 发送弹幕
   67 |     await page.fill('input[type="text"]', 'API测试弹幕');
   68 |     await page.click('button[type="submit"]');
   69 |
   70 |     // 等待响应
   71 |     const response = await responsePromise;
   72 |     expect(response.status()).toBe(200);
   73 |     
   74 |     const responseData = await response.json();
   75 |     expect(responseData).toHaveProperty('success', true);
   76 |   });
   77 |
   78 |   test('弹幕历史记录 API 测试', async () => {
   79 |     // 监听历史记录请求
   80 |     const responsePromise = page.waitForResponse(response => 
   81 |       response.url().includes('/api/history') && 
   82 |       response.request().method() === 'GET'
   83 |     );
   84 |
   85 |     // 触发历史记录加载
   86 |     await page.click('.history-button'); // 假设有一个历史记录按钮
   87 |
   88 |     // 等待响应
   89 |     const response = await responsePromise;
   90 |     expect(response.status()).toBe(200);
   91 |     
   92 |     const history = await response.json();
   93 |     expect(Array.isArray(history)).toBeTruthy();
   94 |   });
   95 |
   96 |   test('错误处理测试', async () => {
   97 |     // 模拟网络错误
   98 |     await page.route('**/api/danmu', route => {
   99 |       route.abort('failed');
  100 |     });
  101 |
  102 |     // 发送弹幕
> 103 |     await page.fill('input[type="text"]', '错误测试弹幕');
      |                ^ Error: page.fill: Target page, context or browser has been closed
  104 |     await page.click('button[type="submit"]');
  105 |
  106 |     // 验证错误提示是否显示
  107 |     const errorMessage = await page.locator('.error-message');
  108 |     await expect(errorMessage).toBeVisible();
  109 |     await expect(errorMessage).toContainText('发送失败');
  110 |   });
  111 |
  112 |   test('重连机制测试', async () => {
  113 |     // 断开 WebSocket 连接
  114 |     await page.evaluate(() => {
  115 |       window.socket.disconnect();
  116 |     });
  117 |
  118 |     // 等待重连
  119 |     await page.waitForTimeout(1000);
  120 |
  121 |     // 验证是否自动重连
  122 |     const isReconnected = await page.evaluate(() => {
  123 |       return window.socket.connected;
  124 |     });
  125 |     expect(isReconnected).toBeTruthy();
  126 |   });
  127 |
  128 |   test('消息限流测试', async () => {
  129 |     // 快速发送多条消息
  130 |     for (let i = 0; i < 5; i++) {
  131 |       await page.fill('input[type="text"]', `限流测试 ${i}`);
  132 |       await page.click('button[type="submit"]');
  133 |     }
  134 |
  135 |     // 验证是否出现限流提示
  136 |     const rateLimit = await page.locator('.rate-limit-message');
  137 |     await expect(rateLimit).toBeVisible();
  138 |     await expect(rateLimit).toContainText('发送过于频繁');
  139 |   });
  140 | });
  141 |
```