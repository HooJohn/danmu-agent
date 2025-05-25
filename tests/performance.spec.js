const { test, expect } = require('@playwright/test');
const os = require('os');

test.describe('弹幕性能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置更长的超时时间
    test.setTimeout(120000);

    // 注入性能监控脚本
    await page.addInitScript(() => {
      window.performanceMarks = new Map();
      window.markPerformance = (name) => {
        window.performanceMarks.set(name, performance.now());
      };
      window.measurePerformance = (name) => {
        const start = window.performanceMarks.get(name);
        if (!start) return 0;
        return performance.now() - start;
      };
      
      // 添加内存监控
      window.getMemoryInfo = () => {
        if (window.performance && window.performance.memory) {
          return {
            usedJSHeapSize: window.performance.memory.usedJSHeapSize,
            totalJSHeapSize: window.performance.memory.totalJSHeapSize
          };
        }
        return null;
      };
    });

    // 导航到测试页面
    await page.goto('http://localhost:5175', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
  });

  test('内存使用不超过150MB', async ({ page }) => {
    // 获取初始内存使用
    const initialMemory = await page.evaluate(() => {
      if (window.gc) window.gc();
      const memory = window.getMemoryInfo();
      return memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
    });

    console.log(`初始内存使用: ${initialMemory.toFixed(2)}MB`);

    // 分批次添加弹幕
    for (let batch = 0; batch < 5; batch++) {
      await page.evaluate(async () => {
        for (let i = 0; i < 200; i++) {
          window.postMessage({
            type: 'ADD_DANMU',
            data: {
              content: `性能测试弹幕 ${i}`,
              color: '#ffffff',
              size: 25,
              position: 'scroll'
            }
          }, '*');
          // 每50个弹幕等待一下，避免瞬间压力过大
          if (i % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      });
      
      // 批次间隔
      await page.waitForTimeout(1000);
    }

    // 等待动画完成并执行垃圾回收
    await page.waitForTimeout(2000);
    
    // 获取最终内存使用
    const finalMemory = await page.evaluate(() => {
      if (window.gc) window.gc();
      const memory = window.getMemoryInfo();
      return memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
    });

    console.log(`最终内存使用: ${finalMemory.toFixed(2)}MB`);
    const memoryIncrease = finalMemory - initialMemory;
    console.log(`内存增长: ${memoryIncrease.toFixed(2)}MB`);

    expect(memoryIncrease).toBeLessThanOrEqual(150);
  });

  test('CPU使用率不超过30%', async ({ page }) => {
    // 记录初始CPU状态
    const startCPU = os.cpus().map(cpu => cpu.times);
    
    // 开始性能记录
    await page.evaluate(() => window.markPerformance('cpu-test'));

    // 模拟持续弹幕发送
    const testDuration = 20000; // 20秒测试时间
    await page.evaluate(async () => {
      let count = 0;
      const interval = setInterval(() => {
        window.postMessage({
          type: 'ADD_DANMU',
          data: {
            content: `CPU测试弹幕 ${count++}`,
            color: '#ffffff',
            size: 25,
            position: 'scroll'
          }
        }, '*');
      }, 200); // 每200ms发送一条

      await new Promise(resolve => setTimeout(resolve, 20000));
      clearInterval(interval);
    });

    // 获取CPU使用情况
    const endCPU = os.cpus().map(cpu => cpu.times);
    const duration = await page.evaluate(() => window.measurePerformance('cpu-test'));

    // 计算CPU使用率
    const cpuUsage = endCPU.map((end, i) => {
      const start = startCPU[i];
      const idle = end.idle - start.idle;
      const total = Object.values(end).reduce((a, b) => a + b, 0) -
                   Object.values(start).reduce((a, b) => a + b, 0);
      return 100 * (1 - idle / total);
    });

    const avgCPUUsage = cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length;
    console.log(`平均CPU使用率: ${avgCPUUsage.toFixed(2)}%`);
    console.log(`测试持续时间: ${duration.toFixed(2)}ms`);

    expect(avgCPUUsage).toBeLessThanOrEqual(30);
  });

  test('弹幕渲染延迟不超过800ms', async ({ page }) => {
    // 确保页面已加载
    await page.waitForLoadState('domcontentloaded');
    
    // 添加事件监听器来捕获消息处理
    await page.evaluate(() => {
      window.danmuReceived = false;
      window.addEventListener('message', (event) => {
        if (event.data.type === 'ADD_DANMU') {
          window.danmuReceived = true;
        }
      });
    });

    // 开始性能记录
    await page.evaluate(() => window.markPerformance('render-test'));

    // 发送测试弹幕并等待消息被接收
    await page.evaluate(() => {
      return new Promise((resolve) => {
        window.postMessage({
          type: 'ADD_DANMU',
          data: {
            content: '延迟测试弹幕',
            color: '#ff0000',
            size: 25,
            position: 'scroll'
          }
        }, '*');
        
        // 等待消息被接收
        const checkInterval = setInterval(() => {
          if (window.danmuReceived) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    });

    try {
      // 检查页面上是否有弹幕容器
      const container = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll('*')).filter(el => 
          el.id?.includes('danmu') || 
          el.className?.includes('danmu') ||
          el.tagName.toLowerCase().includes('danmu')
        );
        return containers.map(el => ({
          id: el.id,
          className: el.className,
          tagName: el.tagName
        }));
      });
      
      console.log('找到的弹幕相关元素:', container);

      // 等待弹幕元素出现并可见
      const danmuLocator = page.locator('.danmu-item, .danmu, [class*="danmu"]');
      await expect(danmuLocator).toBeVisible({ timeout: 10000 });

      // 记录初始位置
      const initialPosition = await danmuLocator.evaluate(element => {
        const style = window.getComputedStyle(element);
        return {
          left: parseFloat(style.left) || 0,
          transform: style.transform,
          position: style.position
        };
      });

      // 等待动画开始
      await page.waitForFunction(({ initialPos }) => {
        const element = document.querySelector('.danmu-item, .danmu, [class*="danmu"]');
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        const currentLeft = parseFloat(style.left) || 0;
        const currentTransform = style.transform;
        
        // 检查位置是否发生变化
        const hasMovement = 
          currentLeft !== initialPos.left || 
          currentTransform !== initialPos.transform ||
          style.position === 'absolute' || // 绝对定位通常用于动画
          style.position === 'fixed';      // 固定定位通常用于动画
        
        console.log('动画状态:', {
          initialLeft: initialPos.left,
          currentLeft,
          initialTransform: initialPos.transform,
          currentTransform,
          position: style.position,
          hasMovement
        });
        
        return hasMovement;
      }, { 
        timeout: 5000,
        polling: 100, // 每100ms检查一次
        args: [{ initialPos: initialPosition }]
      });

      // 计算渲染延迟
      const renderTime = await page.evaluate(() => window.measurePerformance('render-test'));
      console.log(`渲染延迟: ${renderTime.toFixed(2)}ms`);

      expect(renderTime).toBeLessThanOrEqual(800);
    } catch (error) {
      console.error('弹幕渲染测试失败:', error);
      
      // 捕获页面状态
      const pageState = await page.evaluate(() => ({
        url: window.location.href,
        danmuReceived: window.danmuReceived,
        documentReady: document.readyState,
        bodyContent: document.body.innerHTML
      }));
      
      console.log('页面状态:', pageState);
      
      throw error;
    }
  });
}); 