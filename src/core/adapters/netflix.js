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
    this.lastProcessedTime = 0; // 时间戳跟踪
    // OCR 相关
    this.lastOcrTime = 0;
    this.ocrCooldown = 2000; // OCR识别冷却时间（毫秒）
    this.ocrProcessing = false; // 防止重复处理
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
      
      // 检查是否已加载Tesseract.js（OCR引擎）
      if (typeof Tesseract === 'undefined') {
        console.warn('未检测到Tesseract.js，将尝试加载');
        // 实际应用中应异步加载Tesseract.js
      }
      
      console.log('Netflix弹幕适配器初始化成功');
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
    const danmuList = [];
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          // 检查添加的节点是否是字幕元素或包含字幕元素
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && node.matches(this.subtitleSelector)) {
              // 如果节点本身就是字幕元素
              const danmu = this.parseSubtitleElement(node);
              if (danmu) danmuList.push(danmu);
            } else {
              // 如果节点是容器，查找其下的字幕元素
              const subtitleElements = node.querySelectorAll(this.subtitleSelector);
              subtitleElements.forEach(element => {
                const danmu = this.parseSubtitleElement(element);
                if (danmu) danmuList.push(danmu);
              });
            }
          }
        });
      }
    }

    if (danmuList.length > 0 && typeof this.callback === 'function') {
      this.callback(danmuList);
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
  parseSubtitleElement(element) {
    try {
        // 获取字幕文本内容
        const content = element.textContent ? element.textContent.trim() : '';
        if (!content) return null; // 空内容跳过

        // 获取视频当前时间
        const videoElement = document.querySelector('video');
        const currentTime = videoElement ? videoElement.currentTime : 0;

        // 如果与上一个字幕相同，则跳过
        if (content === this.lastSubtitle) {
          return null;
        }
        this.lastSubtitle = content;

        // 创建弹幕对象
        return {
          id: Date.now().toString(),
          platform: 'netflix',
          author: '字幕',
          content,
          color: '#FFFFFF',
          videoTime: currentTime,
          timestamp: Date.now(),
          isSubtitle: true
        };
    } catch (error) {
      console.error('解析 Netflix 字幕元素失败:', element, error);
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
