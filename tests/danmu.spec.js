const { test, expect } = require('@playwright/test');

test.describe('弹幕功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置更长的超时时间
    test.setTimeout(30000);

    // 添加页面错误监听
    page.on('pageerror', exception => {
      console.error('页面错误:', exception);
    });

    page.on('console', msg => {
      console.log('页面日志:', msg.text());
    });

    // 在每个测试前导航到目标页面
    await page.goto('http://localhost:5175', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待页面完全加载
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    // 确保弹幕容器存在
    await expect(page.locator('#danmuContainer')).toBeVisible();

    console.log('页面已准备就绪');
  });

  test('应该能正确显示弹幕', async ({ page }) => {
    try {
      // 添加消息监听器
      await page.evaluate(() => {
        window.addEventListener('message', (event) => {
          console.log('收到消息:', event.data);
          if (event.data.type === 'ADD_DANMU') {
            console.log('收到弹幕消息:', event.data);
          }
        });
      });

      // 模拟发送弹幕
      const testMessage = '测试弹幕消息';
      await page.evaluate((message) => {
        return new Promise((resolve) => {
          window.postMessage({
            type: 'ADD_DANMU',
            data: {
              content: message,
              color: '#ffffff',
              size: 25,
              position: 'scroll',
              platform: 'default'
            }
          }, '*');
          
          // 等待消息被处理
          setTimeout(resolve, 2000);
        });
      }, testMessage);

      // 等待弹幕元素出现
      const danmuLocator = page.locator('.danmu-item');
      await expect(danmuLocator).toBeVisible({ timeout: 15000 });
      
      // 获取弹幕文本
      const text = await danmuLocator.textContent();
      console.log('弹幕文本:', text);
      
      // 验证文本内容
      expect(text).toContain(testMessage);
    } catch (error) {
      console.error('弹幕显示测试失败:', error);
      
      // 捕获页面状态
      const html = await page.content();
      console.log('页面HTML:', html);
      
      throw error;
    }
  });

  test('应该能正确处理长弹幕', async ({ page }) => {
    try {
      const longMessage = '这是一个非常长的弹幕消息，用来测试长文本的显示效果。'.repeat(3);
      
      await page.evaluate((message) => {
        return new Promise((resolve) => {
          window.postMessage({
            type: 'ADD_DANMU',
            data: {
              content: message,
              color: '#ffffff',
              size: 25,
              position: 'scroll',
              platform: 'default'
            }
          }, '*');
          
          setTimeout(resolve, 2000);
        });
      }, longMessage);

      // 验证长弹幕显示
      const danmuLocator = page.locator('.danmu-item');
      await expect(danmuLocator).toBeVisible({ timeout: 15000 });
      
      // 获取弹幕文本
      const text = await danmuLocator.textContent();
      expect(text).toContain(longMessage);
      
      // 检查样式
      const styles = await danmuLocator.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          display: style.display,
          wordBreak: style.wordBreak
        };
      });
      
      expect(styles.display).toBe('block');
      expect(styles.wordBreak).toBe('break-all');
    } catch (error) {
      console.error('长弹幕测试失败:', error);
      throw error;
    }
  });

  test('应该能正确处理特殊字符', async ({ page }) => {
    try {
      const specialMessage = '测试特殊字符：😊 🎉 \\n \\t <script> &lt; &gt;';
      
      await page.evaluate((message) => {
        return new Promise((resolve) => {
          window.postMessage({
            type: 'ADD_DANMU',
            data: {
              content: message,
              color: '#ffffff',
              size: 25,
              position: 'scroll',
              platform: 'default'
            }
          }, '*');
          
          setTimeout(resolve, 2000);
        });
      }, specialMessage);

      // 验证特殊字符弹幕显示
      const danmuLocator = page.locator('.danmu-item');
      await expect(danmuLocator).toBeVisible({ timeout: 15000 });
      
      // 获取弹幕文本
      const text = await danmuLocator.textContent();
      expect(text).toContain(specialMessage);
    } catch (error) {
      console.error('特殊字符弹幕测试失败:', error);
      throw error;
    }
  });
}); 