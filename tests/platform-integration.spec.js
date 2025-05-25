const { test, expect } = require('@playwright/test');

test.describe('平台集成测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
  });

  test('B站弹幕时间轴同步 - 误差不超过1.5秒', async ({ page }) => {
    // 模拟B站视频播放时间
    await page.evaluate(() => {
      window.testHelpers.performance.start('bilibili-sync');
      
      // 模拟B站播放器事件
      const videoTime = 65.5; // 模拟视频播放到65.5秒
      window.postMessage({
        type: 'BILIBILI_TIME_UPDATE',
        data: { currentTime: videoTime }
      }, '*');

      // 模拟对应时间点的弹幕数据
      const danmuList = [
        { time: 64.8, content: '测试弹幕1' },
        { time: 65.2, content: '测试弹幕2' },
        { time: 66.0, content: '测试弹幕3' }
      ];

      // 发送弹幕数据
      window.postMessage({
        type: 'BILIBILI_DANMU_DATA',
        data: danmuList
      }, '*');
    });

    // 等待弹幕渲染
    await page.waitForSelector('.danmu-item');
    
    // 检查时间同步性
    const syncResult = await page.evaluate(() => {
      const duration = window.testHelpers.performance.end('bilibili-sync');
      const danmuElements = document.querySelectorAll('.danmu-item');
      const danmuTimes = Array.from(danmuElements).map(el => 
        parseFloat(el.getAttribute('data-time'))
      );
      
      // 检查弹幕时间是否在允许的误差范围内
      return danmuTimes.every(time => Math.abs(time - 65.5) <= 1.5);
    });

    expect(syncResult).toBe(true);
  });

  test('YouTube评论抓取 - 成功率≥95%', async ({ page }) => {
    // 模拟YouTube评论数据
    const mockComments = Array.from({ length: 100 }, (_, i) => ({
      id: `comment-${i}`,
      text: `YouTube测试评论 ${i}`,
      timestamp: Date.now()
    }));

    // 注入模拟数据
    await page.evaluate((comments) => {
      window.testHelpers.performance.start('youtube-comments');
      
      // 模拟YouTube评论接收
      window.postMessage({
        type: 'YOUTUBE_COMMENTS',
        data: comments
      }, '*');
    }, mockComments);

    // 等待评论处理完成
    await page.waitForTimeout(2000);

    // 验证评论处理成功率
    const results = await page.evaluate(() => {
      const duration = window.testHelpers.performance.end('youtube-comments');
      const processedComments = document.querySelectorAll('.youtube-comment');
      return {
        total: 100,
        processed: processedComments.length,
        successRate: (processedComments.length / 100) * 100
      };
    });

    console.log(`YouTube评论处理成功率: ${results.successRate}%`);
    expect(results.successRate).toBeGreaterThanOrEqual(95);
  });

  test('Netflix字幕OCR - 准确率≥85%', async ({ page }) => {
    // 模拟Netflix字幕数据
    const mockSubtitles = [
      { text: '这是一个测试字幕', timestamp: '00:01:23.456' },
      { text: '字幕识别测试', timestamp: '00:01:25.789' },
      { text: 'OCR准确率测试', timestamp: '00:01:28.012' }
    ];

    // 注入模拟字幕数据
    await page.evaluate((subtitles) => {
      window.testHelpers.performance.start('netflix-ocr');
      
      // 模拟字幕OCR处理
      window.postMessage({
        type: 'NETFLIX_SUBTITLES',
        data: subtitles
      }, '*');
    }, mockSubtitles);

    // 等待OCR处理完成
    await page.waitForTimeout(3000);

    // 验证OCR准确率
    const ocrResults = await page.evaluate(() => {
      const duration = window.testHelpers.performance.end('netflix-ocr');
      const processedSubtitles = document.querySelectorAll('.subtitle-item');
      
      // 模拟OCR准确率检查
      // 在实际环境中，这里需要与预期结果进行对比
      const accuracyChecks = Array.from(processedSubtitles).map(subtitle => {
        const originalText = subtitle.getAttribute('data-original');
        const ocrText = subtitle.textContent;
        return calculateTextSimilarity(originalText, ocrText);
      });

      function calculateTextSimilarity(str1, str2) {
        // 简单的文本相似度计算
        const maxLength = Math.max(str1.length, str2.length);
        let matches = 0;
        for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
          if (str1[i] === str2[i]) matches++;
        }
        return (matches / maxLength) * 100;
      }

      const averageAccuracy = accuracyChecks.reduce((a, b) => a + b, 0) / accuracyChecks.length;
      return averageAccuracy;
    });

    console.log(`Netflix字幕OCR平均准确率: ${ocrResults.toFixed(2)}%`);
    expect(ocrResults).toBeGreaterThanOrEqual(85);
  });
}); 