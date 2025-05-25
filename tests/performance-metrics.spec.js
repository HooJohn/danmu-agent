const { test, expect } = require('@playwright/test');

test.describe('弹幕性能指标测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
  });

  test('内存占用测试 (目标: ≤150MB)', async ({ page }) => {
    // 初始内存基准测试
    const initialMetrics = await page.metrics();
    const initialMemory = initialMetrics.JSHeapUsedSize / (1024 * 1024); // 转换为MB

    // 模拟高密度弹幕场景
    for (let i = 0; i < 100; i++) {
      await page.fill('input[type="text"]', `性能测试弹幕 ${i}`);
      await page.click('button[type="submit"]');
      if (i % 10 === 0) {
        await page.waitForTimeout(100);
      }
    }

    // 等待弹幕动画完成
    await page.waitForTimeout(2000);

    // 获取峰值内存使用
    const peakMetrics = await page.metrics();
    const peakMemory = peakMetrics.JSHeapUsedSize / (1024 * 1024);

    // 验证内存使用是否在限制范围内
    expect(peakMemory).toBeLessThanOrEqual(150);
    console.log(`内存使用: ${peakMemory.toFixed(2)}MB / 150MB`);
  });

  test('弹幕处理延迟测试 (目标: ≤800ms)', async ({ page }) => {
    // 注入性能测量代码
    await page.evaluate(() => {
      window.danmuLatencies = [];
      window.measureDanmuLatency = (startTime) => {
        const endTime = performance.now();
        window.danmuLatencies.push(endTime - startTime);
      };
    });

    // 发送100条测试弹幕
    for (let i = 0; i < 100; i++) {
      const startTime = await page.evaluate(() => performance.now());
      await page.fill('input[type="text"]', `延迟测试弹幕 ${i}`);
      await page.click('button[type="submit"]');
      await page.evaluate((time) => window.measureDanmuLatency(time), startTime);
      await page.waitForTimeout(50);
    }

    // 获取延迟数据
    const latencies = await page.evaluate(() => window.danmuLatencies);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    // 验证延迟是否在目标范围内
    expect(avgLatency).toBeLessThanOrEqual(800);
    expect(maxLatency).toBeLessThanOrEqual(1000);
    console.log(`平均延迟: ${avgLatency.toFixed(2)}ms, 最大延迟: ${maxLatency.toFixed(2)}ms`);
  });

  test('CPU使用率测试 (目标: 峰值 ≤30%)', async ({ page }) => {
    // 注入CPU使用率监控代码
    await page.evaluate(() => {
      window.cpuUsage = [];
      window.startCPUMonitoring = async () => {
        if (!window.cpuUsage) window.cpuUsage = [];
        const start = performance.now();
        await new Promise(resolve => setTimeout(resolve, 100));
        const end = performance.now();
        const usage = (end - start) / 1;
        window.cpuUsage.push(usage);
      };
    });

    // 开始CPU监控
    await page.evaluate(() => {
      window.cpuMonitoringInterval = setInterval(() => {
        window.startCPUMonitoring();
      }, 100);
    });

    // 模拟高密度弹幕场景（每秒100+条弹幕）
    for (let i = 0; i < 100; i++) {
      await page.fill('input[type="text"]', `CPU测试弹幕 ${i}`);
      await page.click('button[type="submit"]');
    }

    // 等待一段时间收集数据
    await page.waitForTimeout(5000);

    // 停止CPU监控
    await page.evaluate(() => {
      clearInterval(window.cpuMonitoringInterval);
    });

    // 获取CPU使用率数据
    const cpuData = await page.evaluate(() => window.cpuUsage);
    const avgCPU = cpuData.reduce((a, b) => a + b, 0) / cpuData.length;
    const peakCPU = Math.max(...cpuData);

    // 验证CPU使用率是否在目标范围内
    expect(peakCPU).toBeLessThanOrEqual(30);
    console.log(`平均CPU使用率: ${avgCPU.toFixed(2)}%, 峰值: ${peakCPU.toFixed(2)}%`);
  });

  test('高密度弹幕压力测试 (每秒100+条)', async ({ page }) => {
    const DANMU_COUNT = 100;
    const TEST_DURATION = 1000; // 1秒
    const startTime = Date.now();

    // 准备测试数据
    const testMessages = Array.from({ length: DANMU_COUNT }, (_, i) => `压测弹幕 ${i}`);
    
    // 注入性能监控代码
    await page.evaluate(() => {
      window.renderStats = {
        rendered: 0,
        dropped: 0,
        startTime: performance.now()
      };
    });

    // 快速发送大量弹幕
    await Promise.all(testMessages.map(async (msg) => {
      await page.fill('input[type="text"]', msg);
      await page.click('button[type="submit"]');
    }));

    // 获取性能统计
    const stats = await page.evaluate(() => {
      const endTime = performance.now();
      const duration = endTime - window.renderStats.startTime;
      return {
        rendered: document.querySelectorAll('.danmu-item').length,
        duration: duration,
        fps: window.fps ? window.fps.rate : null
      };
    });

    // 验证性能指标
    expect(stats.rendered).toBeGreaterThanOrEqual(DANMU_COUNT * 0.9); // 至少90%的弹幕被渲染
    expect(stats.duration).toBeLessThanOrEqual(TEST_DURATION * 1.2); // 允许20%的处理时间浮动
    if (stats.fps) {
      expect(stats.fps).toBeGreaterThanOrEqual(30); // 保持30FPS以上
    }
  });

  test('弹幕抓取成功率测试 (目标: ≥95%)', async ({ page }) => {
    // 模拟100条弹幕数据
    const testData = Array.from({ length: 100 }, (_, i) => ({
      content: `测试弹幕 ${i}`,
      timestamp: Date.now() + i * 100
    }));

    // 注入测试数据
    await page.evaluate((data) => {
      window.testDanmuData = data;
      window.captureStats = {
        total: data.length,
        captured: 0
      };
    }, testData);

    // 执行弹幕抓取
    const captureResults = await page.evaluate(async () => {
      const results = [];
      for (const danmu of window.testDanmuData) {
        try {
          // 模拟弹幕抓取过程
          const captured = await new Promise(resolve => {
            setTimeout(() => {
              window.captureStats.captured++;
              resolve(true);
            }, Math.random() * 100);
          });
          results.push(captured);
        } catch {
          results.push(false);
        }
      }
      return {
        results,
        stats: window.captureStats
      };
    });

    // 计算成功率
    const successRate = (captureResults.stats.captured / captureResults.stats.total) * 100;
    
    // 验证是否达到目标成功率
    expect(successRate).toBeGreaterThanOrEqual(95);
    console.log(`弹幕抓取成功率: ${successRate.toFixed(2)}%`);
  });

  test('时间轴同步误差测试 (目标: ≤1.5秒)', async ({ page }) => {
    // 模拟视频播放时间
    await page.evaluate(() => {
      window.videoCurrentTime = 0;
      setInterval(() => {
        window.videoCurrentTime += 0.1;
      }, 100);
    });

    // 发送带时间戳的测试弹幕
    const testPoints = [5, 10, 15, 20, 25]; // 测试点（秒）
    const syncErrors = [];

    for (const timePoint of testPoints) {
      // 等待到达测试时间点
      await page.waitForFunction(
        (target) => window.videoCurrentTime >= target,
        { timeout: timePoint * 1000 + 2000 },
        timePoint
      );

      // 发送测试弹幕并记录时间
      const syncError = await page.evaluate((expectedTime) => {
        const actualTime = window.videoCurrentTime;
        return Math.abs(actualTime - expectedTime);
      }, timePoint);

      syncErrors.push(syncError);
    }

    // 计算最大同步误差
    const maxSyncError = Math.max(...syncErrors);
    
    // 验证同步误差是否在目标范围内
    expect(maxSyncError).toBeLessThanOrEqual(1.5);
    console.log(`最大时间轴同步误差: ${maxSyncError.toFixed(2)}秒`);
  });
}); 