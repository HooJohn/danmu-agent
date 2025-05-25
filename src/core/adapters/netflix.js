// src/core/adapters/netflix.js

/**
 * Netflix平台弹幕适配器（使用OCR技术或DOM解析）
 * 由于Netflix不提供弹幕功能，本适配器主要抓取字幕作为模拟弹幕
 */


class NetflixAdapter extends DanmuAdapter {
  constructor() {
    super('netflix');
    // DOM 解析相关
    this.subtitleSelector = '.player-timedtext';
    // MutationObserver 相关
    this.observer = null;
    this.danmuContainerSelector = '.player-timedtext'; // 字幕容器
    this.callback = null; // 存储回调函数
    // this.lastProcessedTime = 0; // Not actively used, can be kept or removed
    this.lastSubtitle = ''; // To store the last processed subtitle text

    // OCR Related - Commented out as per subtask
    // this.lastOcrTime = 0;
    // this.ocrCooldown = 2000; // OCR识别冷却时间（毫秒）
    // this.ocrProcessing = false; // 防止重复处理
  }

  /**
   * 初始化适配器
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      // 检查当前页面是否为Netflix
      if (!window.location.hostname.includes('netflix.com')) {
        console.warn('当前页面不是Netflix，适配器初始化失败');
        return false;
      }
      
      // OCR Related - Commented out as per subtask
      // // 检查是否已加载Tesseract.js（OCR引擎）
      // if (typeof Tesseract === 'undefined') {
      //   console.warn('未检测到Tesseract.js，将尝试加载');
      //   // 实际应用中应异步加载Tesseract.js
      // }
      
      console.log('Netflix弹幕适配器初始化成功 (DOM mode)');
      return true;
    } catch (error) {
      console.error('Netflix适配器初始化失败:', error);
      return false;
    }
  }

  /**
   * 开始抓取弹幕（字幕）
   * @param {Function} callback 弹幕数据回调函数
   */
  startCapture(callback) {
    this.callback = callback; // 存储回调
    if (this.observer) {
      this.stopCapture(); // 如果已存在，先停止
    }

    // 查找字幕容器
    const targetNode = document.querySelector(this.danmuContainerSelector);
    if (!targetNode) {
      console.error(`Netflix 字幕容器 (${this.danmuContainerSelector}) 未找到，无法启动 MutationObserver`);
      // Netflix 的 .player-timedtext 可能是动态加载的，可以尝试等待
      // 或者在 content.js 中注入脚本以访问 iframe 内容
      return;
    }

    // 配置 MutationObserver
    const config = { childList: true, subtree: true };

    // 创建一个观察器实例并传入回调函数
    this.observer = new MutationObserver((mutationsList) => {
      this.handleMutations(mutationsList);
    });

    // 开始观察目标节点
    this.observer.observe(targetNode, config);
    console.log(`Netflix 适配器: MutationObserver 已启动，监听 ${this.danmuContainerSelector}`);

    // 初始处理已存在的字幕
    this.processExistingSubtitles(targetNode);
  }

  /**
   * 停止抓取字幕
   */
  stopCapture() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log("Netflix 适配器: MutationObserver 已停止");
    }
    this.callback = null; // 清除回调
  }

  /**
   * 处理 MutationObserver 检测到的变化
   * @param {MutationRecord[]} mutationsList
   */
  handleMutations(mutationsList) {
    let processTargetNode = null; // The .player-timedtext node

    for (const mutation of mutationsList) {
      // If the observed node itself (this.danmuContainerSelector) has direct child changes
      // or if a child of it changes, we re-parse the whole container.
      // Netflix usually replaces spans inside .player-timedtext-text-container
      if (mutation.target && mutation.target.closest(this.danmuContainerSelector)) {
         processTargetNode = mutation.target.closest(this.danmuContainerSelector);
         break; 
      } else if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
         // Check if any added node is the container itself or within it
         for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches && node.matches(this.danmuContainerSelector)) {
                    processTargetNode = node;
                    break;
                }
                const parentContainer = node.closest(this.danmuContainerSelector);
                if (parentContainer) {
                    processTargetNode = parentContainer;
                    break;
                }
            }
         }
         if (processTargetNode) break;
      }
    }

    if (processTargetNode) {
      const danmu = this.parseSubtitleElement(processTargetNode);
      if (danmu && typeof this.callback === 'function') {
        this.callback([danmu]); // Send as a list
      }
    }
  }

  /**
   * 处理初始加载时已存在的字幕
   * @param {Element} containerNode - 字幕容器节点
   */
  processExistingSubtitles(containerNode) {
     const subtitleElements = containerNode.querySelectorAll(this.subtitleSelector);
     const danmuList = [];
     subtitleElements.forEach(element => {
       const danmu = this.parseSubtitleElement(element);
       if (danmu) danmuList.push(danmu);
     });
     if (danmuList.length > 0 && typeof this.callback === 'function') {
       console.log(`Netflix 适配器: 处理了 ${danmuList.length} 条初始字幕`);
       this.callback(danmuList);
     }
  }

  /**
   * 解析单个字幕元素为模拟弹幕对象
   * @param {Element} element - 字幕元素
   * @returns {object|null} 弹幕对象，如果解析失败则返回 null
   */
  parseSubtitleElement(element) { // element is expected to be .player-timedtext
    try {
        // Find all text spans within the .player-timedtext-text-container
        const textSpans = element.querySelectorAll('.player-timedtext-text-container span');
        if (!textSpans || textSpans.length === 0) {
          // If no spans, it might be an empty subtitle, clear lastSubtitle
          if (this.lastSubtitle !== '') {
             this.lastSubtitle = '';
             // Optionally, send an empty message to clear display if needed by UI
             // For now, just returning null means no new danmu.
          }
          return null;
        }

        let fullSubtitleText = [];
        textSpans.forEach(span => {
            const text = span.textContent ? span.textContent.trim() : '';
            if (text) {
                fullSubtitleText.push(text);
            }
        });
        
        const content = fullSubtitleText.join(' ').trim();

        if (!content) { // All spans were empty or just whitespace
          if (this.lastSubtitle !== '') {
            this.lastSubtitle = '';
          }
          return null;
        }

        // 获取视频当前时间
        const videoElement = document.querySelector('video'); // Netflix usually has one main video tag
        const currentTime = videoElement ? videoElement.currentTime : 0;

        // 如果与上一个字幕相同，则跳过
        if (content === this.lastSubtitle) {
          return null;
        }
        this.lastSubtitle = content; // Update lastSubtitle with the new full text

        // 创建弹幕对象
        return {
          id: `netflix_${Date.now()}`, // More specific ID
          platform: 'netflix',
          author: '字幕', // Netflix subtitles don't have authors
          content,
          color: '#FFFFFF', // Default color
          videoTime: parseFloat(currentTime.toFixed(3)),
          timestamp: Date.now(),
          isSubtitle: true // Flag to indicate this is a subtitle
        };
    } catch (error) {
      console.error('解析 Netflix 字幕元素失败:', element, error); // Keep this log
      return null;
    }
  }

  // 移除旧的 captureSubtitles 方法

  /**
  async captureSubtitles() {
    try {
      // 方法1：直接从DOM中获取字幕文本
      const subtitleElement = document.querySelector(this.subtitleSelector);
      if (subtitleElement) {
        const text = subtitleElement.textContent.trim();
        
        // 如果字幕与上次相同，则跳过
        if (text === this.lastSubtitle || text === '') {
          return [];
        }
        
        this.lastSubtitle = text;
        
        // 获取视频当前时间
        const videoElement = document.querySelector('video');
        const currentTime = videoElement ? videoElement.currentTime : 0;
        
        return [{
          id: Date.now().toString(),
          platform: 'netflix',
          author: '字幕',
          content: text,
          color: '#FFFFFF',
          videoTime: currentTime,
          timestamp: Date.now(),
          isSubtitle: true
        }];
      }
      
      // 方法2：当DOM方法失效时使用OCR识别
      // OCR很消耗资源，所以设置冷却时间
      const now = Date.now();
      if (now - this.lastOcrTime < this.ocrCooldown) {
        return [];
      }
      
      this.lastOcrTime = now;
      
      // 实际应用中应调用Tesseract.js进行OCR识别
      // 此处简化处理，仅作为示例
      return [];
      
    } catch (error) {
      console.error('抓取Netflix字幕失败:', error);
      return [];
    }
  }

  /**
   * 获取视频标题
   * @returns {string} 视频标题
   */
  getVideoTitle() {
    try {
      const titleElement = document.querySelector('.video-title h4');
      return titleElement ? titleElement.textContent.trim() : '未知视频';
    } catch (error) {
      console.error('获取Netflix视频标题失败:', error);
      return '未知视频';
    }
  }

  /**
   * 获取当前剧集信息
   * @returns {Object} 剧集信息
   */
  getEpisodeInfo() {
    try {
      const seasonElement = document.querySelector('.video-title span');
      const episodeElement = document.querySelector('.video-title span:nth-child(2)');
      
      return {
        title: this.getVideoTitle(),
        season: seasonElement ? seasonElement.textContent.trim() : '',
        episode: episodeElement ? episodeElement.textContent.trim() : ''
      };
    } catch (error) {
      console.error('获取Netflix剧集信息失败:', error);
      return { title: '未知剧集', season: '', episode: '' };
    }
  }
}

export default NetflixAdapter; // 使用 export default
