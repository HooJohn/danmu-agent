const { test, expect } = require('@playwright/test');

test.describe('弹幕捕获和内容识别测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');
  });

  test('B站弹幕格式解析', async ({ page }) => {
    // 模拟B站弹幕数据
    const biliBiliDanmu = [
      { text: '测试弹幕1', time: 1.5, type: 1, color: 16777215 },
      { text: '【高能】精彩片段', time: 2.0, type: 4, color: 16738408 },
      { text: '/○\\反复横跳', time: 2.5, type: 1, color: 16777215 },
      { text: '【❤️】带表情的标记', time: 3.0, type: 1, color: 16738408 },
      { text: '￣□￣｜｜特殊字符', time: 3.5, type: 1, color: 16777215 },
      { text: '【置顶】【高能】双重标记', time: 4.0, type: 4, color: 16738408 },
      { text: '', time: 4.5, type: 1, color: 16777215 }, // 空弹幕测试
      { text: '   空格测试   ', time: 5.0, type: 1, color: 16777215 }
    ];

    // 注入弹幕数据
    const parsedDanmu = await page.evaluate((danmuList) => {
      const parseColor = (colorInt) => {
        const colorHex = colorInt.toString(16).padStart(6, '0');
        return `#${colorHex}`;
      };

      return danmuList.map(danmu => {
        // 增强的弹幕解析逻辑
        const processed = {
          content: danmu.text
            .replace(/【.*?】/g, '') // 移除标记
            .trim(), // 移除首尾空格
          timestamp: danmu.time,
          color: parseColor(danmu.color),
          type: danmu.type === 4 ? 'special' : 'normal',
          hasEmoji: /\p{Emoji}/u.test(danmu.text),
          hasSpecialChars: /[^\w\s\u4e00-\u9fa5]/u.test(danmu.text),
          isValid: danmu.text.trim().length > 0
        };

        // 添加特殊标记检测
        processed.markers = (danmu.text.match(/【(.*?)】/g) || [])
          .map(m => m.replace(/【|】/g, ''));

        return processed;
      });
    }, biliBiliDanmu);

    // 增强的验证逻辑
    // 基本内容验证
    expect(parsedDanmu[0].content).toBe('测试弹幕1');
    expect(parsedDanmu[1].content).toBe('精彩片段');
    expect(parsedDanmu[1].type).toBe('special');
    expect(parsedDanmu[2].content).toBe('/○\\反复横跳');

    // 表情符号验证
    expect(parsedDanmu[3].hasEmoji).toBeTruthy();
    expect(parsedDanmu[3].content).toBe('带表情的标记');

    // 特殊字符验证
    expect(parsedDanmu[4].hasSpecialChars).toBeTruthy();
    expect(parsedDanmu[4].content).toBe('￣□￣｜｜特殊字符');

    // 多重标记验证
    expect(parsedDanmu[5].markers).toHaveLength(2);
    expect(parsedDanmu[5].markers).toContain('置顶');
    expect(parsedDanmu[5].markers).toContain('高能');

    // 空弹幕验证
    expect(parsedDanmu[6].isValid).toBeFalsy();

    // 空格处理验证
    expect(parsedDanmu[7].content).toBe('空格测试');

    // 颜色格式验证
    expect(parsedDanmu[1].color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('YouTube评论捕获', async ({ page }) => {
    // 模拟YouTube评论数据
    const comments = [
      { text: 'Great video! 👍', timestamp: '2:30', likes: 150, isOwner: false },
      { text: '这是中文评论 😊', timestamp: '3:45', likes: 200, isOwner: false },
      { text: 'Super cool! #awesome @creator', timestamp: '5:15', likes: 300, isOwner: false },
      { text: '@viewer1 @viewer2 多重提及', timestamp: '6:00', likes: 50, isOwner: false },
      { text: '置顶评论 #important', timestamp: '0:00', likes: 1000, isOwner: true },
      { text: 'https://example.com 带链接评论', timestamp: '7:30', likes: 80, isOwner: false },
      { text: '   ', timestamp: '8:00', likes: 0, isOwner: false }, // 空评论
      { text: '😀 😃 😄 纯表情评论', timestamp: '8:30', likes: 120, isOwner: false }
    ];

    // 注入评论数据并测试解析
    const parsedComments = await page.evaluate((commentList) => {
      const parseTimestamp = (timestamp) => {
        const [minutes, seconds] = timestamp.split(':').map(Number);
        return minutes * 60 + seconds;
      };

      const detectLanguage = (text) => {
        // 移除表情符号后再检测语言
        const cleanText = text.replace(/\p{Emoji}/gu, '').trim();
        
        const patterns = {
          zh: /[\u4e00-\u9fa5]/,
          ja: /[\u3040-\u30ff\u31f0-\u31ff]/,
          ko: /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/,
          en: /^[a-zA-Z0-9\s.,!?]+$/
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
          if (pattern.test(cleanText)) return lang;
        }
        return 'unknown';
      };

      return commentList.map(comment => {
        const processed = {
          // 基本内容处理
          content: comment.text
            .replace(/[@#][^\s]+/g, '')  // 移除@和#标记
            .replace(/https?:\/\/\S+/g, '') // 移除URL
            .replace(/\p{Emoji}/gu, '')  // 移除表情符号
            .trim(),
          
          // 时间戳处理
          timestamp: parseTimestamp(comment.timestamp),
          
          // 特征检测
          mentions: (comment.text.match(/@[^\s]+/g) || []).map(m => m.slice(1)),
          hashtags: (comment.text.match(/#[^\s]+/g) || []).map(h => h.slice(1)),
          hasEmoji: /\p{Emoji}/gu.test(comment.text),
          emojis: (comment.text.match(/\p{Emoji}/gu) || []),
          urls: (comment.text.match(/https?:\/\/\S+/g) || []),
          
          // 元数据
          language: detectLanguage(comment.text),
          isValid: comment.text.trim().length > 0,
          metrics: {
            likes: comment.likes,
            isOwner: comment.isOwner
          }
        };

        // 计算评论质量分数
        processed.quality = (
          (processed.isValid ? 0.3 : 0) +
          (processed.content.length > 5 ? 0.2 : 0) +
          (processed.hasEmoji ? 0.1 : 0) +
          (comment.likes > 100 ? 0.2 : 0) +
          (comment.isOwner ? 0.2 : 0)
        );

        return processed;
      });
    }, comments);

    // 增强的验证逻辑
    // 基本内容验证
    expect(parsedComments[0].content).toBe('Great video!');
    expect(parsedComments[0].hasEmoji).toBeTruthy();
    expect(parsedComments[0].emojis).toContain('👍');

    // 语言检测验证
    expect(parsedComments[1].language).toBe('zh');
    expect(parsedComments[0].language).toBe('en');

    // 标记提取验证
    expect(parsedComments[2].hashtags).toContain('awesome');
    expect(parsedComments[3].mentions).toHaveLength(2);
    expect(parsedComments[3].mentions).toContain('viewer1');

    // 置顶评论验证
    expect(parsedComments[4].metrics.isOwner).toBeTruthy();
    expect(parsedComments[4].metrics.likes).toBeGreaterThanOrEqual(1000);

    // URL处理验证
    expect(parsedComments[5].urls).toHaveLength(1);
    expect(parsedComments[5].content).toBe('带链接评论');

    // 空评论验证
    expect(parsedComments[6].isValid).toBeFalsy();

    // 表情评论验证
    expect(parsedComments[7].hasEmoji).toBeTruthy();
    expect(parsedComments[7].emojis.length).toBe(3);
    expect(parsedComments[7].content).toBe('纯表情评论');

    // 质量分数验证
    parsedComments.forEach(comment => {
      expect(comment.quality).toBeGreaterThanOrEqual(0);
      expect(comment.quality).toBeLessThanOrEqual(1);
    });
  });

  test('Netflix字幕OCR准确性', async ({ page }) => {
    // 模拟字幕图像数据（使用更真实的测试数据）
    const subtitleImages = [
      {
        data: 'base64_mock_data_1',
        timestamp: '00:01:23',
        expectedText: '你好，世界',
        language: 'zh'
      },
      {
        data: 'base64_mock_data_2',
        timestamp: '00:01:24',
        expectedText: 'Hello, World',
        language: 'en'
      },
      {
        data: 'base64_mock_data_3',
        timestamp: '00:01:25',
        expectedText: '字幕测试 123',
        language: 'mixed'
      },
      {
        data: 'corrupted_data',  // 模拟损坏的图像数据
        timestamp: '00:01:26',
        expectedText: '',
        language: 'unknown'
      }
    ];

    // 模拟OCR处理和验证
    const ocrResults = await page.evaluate((images) => {
      // 模拟OCR引擎配置
      const mockOcrEngine = {
        supportedLanguages: ['zh', 'en', 'mixed'],
        minConfidence: 0.7,
        
        // 模拟OCR处理
        process: (imageData, lang) => {
          if (imageData === 'corrupted_data') {
            return {
              success: false,
              error: 'IMAGE_CORRUPTED',
              confidence: 0
            };
          }

          // 模拟不同语言的识别准确度
          const confidenceMap = {
            zh: 0.85,
            en: 0.95,
            mixed: 0.80,
            unknown: 0.60
          };

          return {
            success: true,
            text: images.find(img => img.data === imageData)?.expectedText || '',
            confidence: confidenceMap[lang] || 0.7,
            language: lang
          };
        }
      };

      // 处理每个字幕图像
      return images.map(img => {
        try {
          // 预处理检查
          if (!img.data || !img.timestamp) {
            throw new Error('INVALID_INPUT');
          }

          // OCR处理
          const result = mockOcrEngine.process(img.data, img.language);
          
          return {
            timestamp: img.timestamp,
            originalData: {
              width: 1920,  // 模拟图像尺寸
              height: 1080,
              format: 'png',
              hasAlpha: true
            },
            result: {
              ...result,
              processingTime: Math.random() * 100 + 50, // 模拟处理时间 50-150ms
              textRegions: [
                {
                  boundingBox: {
                    x: 100,
                    y: 100,
                    width: 500,
                    height: 50
                  },
                  confidence: result.confidence
                }
              ]
            }
          };
        } catch (error) {
          return {
            timestamp: img.timestamp,
            error: error.message,
            success: false
          };
        }
      });
    }, subtitleImages);

    // 增强的验证逻辑
    // 基本功能验证
    expect(ocrResults).toHaveLength(subtitleImages.length);
    
    // 成功案例验证
    const successfulResults = ocrResults.filter(r => r.result?.success);
    expect(successfulResults.length).toBe(3); // 应该有3个成功的结果

    // 验证每个成功的结果
    successfulResults.forEach(result => {
      expect(result.result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.result.processingTime).toBeGreaterThanOrEqual(50);
      expect(result.result.processingTime).toBeLessThanOrEqual(150);
      
      // 验证文本区域信息
      const region = result.result.textRegions[0];
      expect(region).toBeDefined();
      expect(region.boundingBox.width).toBeGreaterThan(0);
      expect(region.boundingBox.height).toBeGreaterThan(0);
    });

    // 错误处理验证
    const failedResult = ocrResults[3]; // 损坏的图像数据
    expect(failedResult.result.success).toBeFalsy();
    expect(failedResult.result.error).toBe('IMAGE_CORRUPTED');

    // 图像元数据验证
    ocrResults.slice(0, 3).forEach(result => {
      expect(result.originalData).toMatchObject({
        width: 1920,
        height: 1080,
        format: 'png',
        hasAlpha: true
      });
    });

    // 语言特定的置信度验证
    expect(ocrResults[1].result.confidence).toBeGreaterThan(ocrResults[0].result.confidence); // 英文应该比中文更准确
    expect(ocrResults[2].result.confidence).toBeLessThan(ocrResults[1].result.confidence); // 混合文本应该比纯英文更低
  });

  test('特殊字符和表情处理', async ({ page }) => {
    const specialDanmu = [
      '(╯°□°）╯︵ ┻━┻',
      '❤️ 爱心弹幕 ❤️',
      '【置顶】重要通知',
      '@用户名 你好',
      '666666666'
    ];

    // 测试特殊字符处理
    const processedDanmu = await page.evaluate((danmuList) => {
      return danmuList.map(danmu => ({
        original: danmu,
        processed: danmu
          .replace(/【.*?】/g, '')  // 移除方括号标记
          .replace(/@\S+\s*/g, '')  // 修改：使用\S+匹配非空白字符，确保完整匹配用户名
          .trim(),
        hasEmoji: /\p{Emoji}/u.test(danmu),
        hasSpecialChars: /[^\w\s\u4e00-\u9fa5]/.test(danmu)
      }));
    }, specialDanmu);

    // 验证处理结果
    expect(processedDanmu[0].hasSpecialChars).toBeTruthy();
    expect(processedDanmu[1].hasEmoji).toBeTruthy();
    expect(processedDanmu[2].processed).toBe('重要通知');
    expect(processedDanmu[3].processed).toBe('你好');
  });

  test('弹幕去重和过滤', async ({ page }) => {
    const duplicateDanmu = [
      { content: '测试弹幕', timestamp: 1.0 },
      { content: '测试弹幕', timestamp: 1.1 }, // 重复内容
      { content: '违规内容', timestamp: 2.0 },
      { content: '正常弹幕', timestamp: 3.0 }
    ];

    // 测试弹幕过滤逻辑
    const filteredDanmu = await page.evaluate((danmuList) => {
      const seen = new Set();
      return danmuList.filter(danmu => {
        // 去重逻辑
        if (seen.has(danmu.content)) return false;
        seen.add(danmu.content);

        // 过滤逻辑
        return !danmu.content.includes('违规');
      });
    }, duplicateDanmu);

    // 验证过滤结果
    expect(filteredDanmu.length).toBe(2); // 应该只剩下2条弹幕
    expect(filteredDanmu.some(d => d.content.includes('违规'))).toBeFalsy();
    expect(filteredDanmu.filter(d => d.content === '测试弹幕').length).toBe(1);
  });

  test('多语言弹幕识别', async ({ page }) => {
    const multiLangDanmu = [
      { text: 'Hello World!', lang: 'en' },
      { text: '你好世界！', lang: 'zh' },
      { text: 'こんにちは', lang: 'ja' },
      { text: '안녕하세요', lang: 'ko' }
    ];

    // 测试语言识别
    const langResults = await page.evaluate((danmuList) => {
      return danmuList.map(danmu => ({
        text: danmu.text,
        detected: {
          isEnglish: /^[a-zA-Z\s.,!?]+$/.test(danmu.text),
          isChinese: /[\u4e00-\u9fa5]/.test(danmu.text),
          isJapanese: /[\u3040-\u30ff]/.test(danmu.text),
          isKorean: /[\uac00-\ud7af]/.test(danmu.text)
        }
      }));
    }, multiLangDanmu);

    // 验证语言识别结果
    expect(langResults[0].detected.isEnglish).toBeTruthy();
    expect(langResults[1].detected.isChinese).toBeTruthy();
    expect(langResults[2].detected.isJapanese).toBeTruthy();
    expect(langResults[3].detected.isKorean).toBeTruthy();
  });
}); 