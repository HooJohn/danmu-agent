const { test, expect } = require('@playwright/test');

// 在所有测试开始前运行的全局设置
async function globalSetup() {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // 检查开发服务器是否运行
    await page.goto('http://localhost:5175');
    console.log('✅ 开发服务器运行正常');
  } catch (error) {
    console.error('❌ 开发服务器未运行，请先运行 npm run dev');
    process.exit(1);
  }

  // 检查必要的浏览器API是否可用
  const apiCheck = await page.evaluate(() => {
    return {
      webSocket: typeof WebSocket !== 'undefined',
      performance: typeof performance !== 'undefined',
      canvas: typeof document.createElement('canvas').getContext === 'function',
      webGL: (() => {
        try {
          return !!document.createElement('canvas').getContext('webgl');
        } catch {
          return false;
        }
      })()
    };
  });

  // 输出环境检查结果
  console.log('\n环境检查结果:');
  Object.entries(apiCheck).forEach(([api, available]) => {
    console.log(`${available ? '✅' : '❌'} ${api}`);
  });

  // 检查系统资源
  const metrics = await page.metrics();
  console.log('\n系统资源状态:');
  console.log(`- JS堆内存: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`- DOM节点数: ${metrics.Nodes}`);

  await browser.close();
}

// 在每个测试文件开始前运行的设置
async function testSetup({ page }) {
  // 设置更合理的超时时间
  test.setTimeout(30000);

  // 注入测试辅助函数
  await page.addInitScript(() => {
    window.testHelpers = {
      // 等待元素稳定（用于动画完成后的断言）
      waitForStable: async (selector, timeout = 2000) => {
        const startTime = Date.now();
        let lastRect = null;
        
        while (Date.now() - startTime < timeout) {
          const element = document.querySelector(selector);
          if (!element) return false;
          
          const rect = element.getBoundingClientRect();
          const current = JSON.stringify(rect);
          
          if (lastRect === current) {
            return true;
          }
          
          lastRect = current;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return false;
      },
      
      // 性能监控
      performance: {
        marks: new Set(),
        start: (name) => {
          performance.mark(`${name}_start`);
          window.testHelpers.performance.marks.add(name);
        },
        end: (name) => {
          if (window.testHelpers.performance.marks.has(name)) {
            performance.mark(`${name}_end`);
            performance.measure(name, `${name}_start`, `${name}_end`);
            return performance.getEntriesByName(name)[0].duration;
          }
          return null;
        }
      },
      
      // 错误捕获
      errors: {
        list: [],
        start: () => {
          window.addEventListener('error', (e) => {
            window.testHelpers.errors.list.push(e);
          });
        },
        get: () => window.testHelpers.errors.list
      }
    };
  });

  // 设置请求拦截
  await page.route('**/*', async (route) => {
    const request = route.request();
    // 记录所有网络请求
    console.log(`${request.method()} ${request.url()}`);
    await route.continue();
  });

  return page;
}

module.exports = { globalSetup, testSetup }; 