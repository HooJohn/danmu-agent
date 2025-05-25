// src/core/adapters/bilibili.js

/**
 * B站平台弹幕适配器
 * 负责从B站视频页面抓取弹幕
 */

import { DanmuAdapter } from './adapter-interface.js'; // 使用 import

class BilibiliAdapter extends DanmuAdapter {
  constructor() {
    super('bilibili');
    // B站弹幕选择器 (需要验证和更新, 可能在 video 元素内部的 canvas 或特定 div)
    this.danmuSelector = '.bili-danmaku, .bpx-player-dm-item'; // 尝试多个可能的选择器
    // this.interval = null; // 不再需要 interval
    this.observer = null; // 添加 MutationObserver 实例
    // B站弹幕容器选择器 (优先级: .bpx-player-dm-container, .bilibili-player-video-danmaku, then fallback)
    this.danmuContainerSelector = '.bpx-player-dm-container'; // Preferred modern selector
    this.danmuContainerSelectorFallback1 = '.bilibili-player-video-danmaku'; // Older common selector
    this.danmuContainerSelectorFallback2 = '.bpx-player-video-wrap'; // General video area as wider fallback
    this.callback = null; // 存储回调函数
    this.videoElement = null; // Cache video element
  }

  /**
   * 初始化适配器
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      // 检查当前页面是否为B站
      if (!window.location.hostname.includes('bilibili.com')) {
        console.warn('当前页面不是bilibili，适配器初始化失败');
        return false;
      }
      
      console.log('B站弹幕适配器初始化成功');
      return true;
    } catch (error) {
      console.error('B站适配器初始化失败:', error);
      return false;
    }
  }

  /**
   * 开始抓取弹幕
   * @param {Function} callback 弹幕数据回调函数
   */
  startCapture(callback) {
    this.callback = callback; // 存储回调
    if (this.observer) {
      this.stopCapture(); // 如果已存在，先停止
    }

    this.videoElement = document.querySelector('video.bpx-player-video-element') || document.querySelector('video');
    if (!this.videoElement) {
        console.error('Bilibili 适配器: 未找到视频播放元素。');
        // return; // Optionally stop if video element is crucial for timestamp fallbacks
    }

    let targetNode = document.querySelector(this.danmuContainerSelector);

    if (!targetNode) {
      console.warn(`Bilibili 弹幕容器 (${this.danmuContainerSelector}) 未找到, 尝试备选1: ${this.danmuContainerSelectorFallback1}`);
      targetNode = document.querySelector(this.danmuContainerSelectorFallback1);
    }

    if (!targetNode) {
      console.warn(`Bilibili 弹幕容器 (${this.danmuContainerSelectorFallback1}) 未找到, 尝试备选2: ${this.danmuContainerSelectorFallback2}`);
      targetNode = document.querySelector(this.danmuContainerSelectorFallback2);
    }
    
    if (!targetNode) {
      // Fallback to the player root if specific danmu containers are not found
      targetNode = document.querySelector('.bpx-player-container');
      if (targetNode) {
        console.warn(`所有特定弹幕容器均未找到, 尝试监听播放器根元素: .bpx-player-container`);
      } else {
        console.error(`Bilibili 弹幕容器及播放器根元素均未找到，无法启动 MutationObserver`);
        return; // 彻底失败
      }
    }
    
    // 配置 MutationObserver
    const config = { childList: true, subtree: true }; 

    // 创建一个观察器实例并传入回调函数
    this.observer = new MutationObserver((mutationsList) => this.handleMutations(mutationsList));

    // 开始观察目标节点
    this.observer.observe(targetNode, config);
    console.log(`Bilibili 适配器: MutationObserver 已启动，监听目标:`, targetNode);

    // 初始抓取一次已存在的弹幕
    this.processExistingDanmu(targetNode);
  }

  /**
   * 停止抓取弹幕
   */
  stopCapture() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log("Bilibili 适配器: MutationObserver 已停止");
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
          // 检查添加的节点是否是弹幕元素或包含弹幕元素
          if (node.nodeType === Node.ELEMENT_NODE) {
            // B站弹幕元素可能没有稳定的 class，需要更复杂的判断
            // 暂时使用 constructor 中定义的 danmuSelector
            if (node.matches && node.matches(this.danmuSelector)) {
              const danmu = this.parseDanmuElement(node);
              if (danmu) danmuList.push(danmu);
            } else {
              // 查找子元素
              const danmuElements = node.querySelectorAll(this.danmuSelector);
              danmuElements.forEach(element => {
                const danmu = this.parseDanmuElement(element);
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
   * 处理初始加载时已存在的弹幕
   * @param {Element} containerNode - 弹幕容器节点
   */
  processExistingDanmu(containerNode) {
     const danmuElements = containerNode.querySelectorAll(this.danmuSelector);
     const danmuList = [];
     danmuElements.forEach(element => {
       const danmu = this.parseDanmuElement(element);
       if (danmu) danmuList.push(danmu);
     });
     if (danmuList.length > 0 && typeof this.callback === 'function') {
       console.log(`Bilibili 适配器: 处理了 ${danmuList.length} 条已存在的弹幕`);
       this.callback(danmuList);
     }
  }

  /**
   * 解析单个B站弹幕 DOM 元素
   * @param {Element} element - 弹幕的 DOM 元素
   * @returns {object|null} 解析后的弹幕对象，如果解析失败则返回 null
   */
  parseDanmuElement(element) {
    try {
        // Danmu ID: Try 'data-id', then 'id' attribute, then generate
        let id = element.dataset.id || element.getAttribute('id');
        if (!id) {
            id = `bili_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        // Content: Trimmed text content. Consider if a child selector is more precise.
        const content = element.textContent ? element.textContent.trim() : '';
        if (!content) return null;

        // Color: From style attribute, default to white
        const color = element.style.color || '#FFFFFF';

        // Video Timestamp (videoTime):
        let videoTime = null;
        // Try 'progress' attribute (often in milliseconds)
        const progressAttr = element.getAttribute('progress');
        if (progressAttr) {
            videoTime = parseFloat(progressAttr) / 1000; // Convert ms to seconds
        } else if (element.dataset.time) {
            videoTime = parseFloat(element.dataset.time);
        } else if (element.dataset.ts) {
            videoTime = parseFloat(element.dataset.ts);
        }

        // Fallback to current video time if no specific timestamp found on danmu element
        if (videoTime === null || isNaN(videoTime)) {
            if (this.videoElement) {
                videoTime = this.videoElement.currentTime;
            } else {
                // Attempt to get video element again if not cached (e.g., if startCapture failed early)
                const currentVideoElement = document.querySelector('video.bpx-player-video-element') || document.querySelector('video');
                videoTime = currentVideoElement ? currentVideoElement.currentTime : 0;
            }
        }
        
        // User ID / Author: Try 'data-user-id' or 'data-uid'
        const authorId = element.dataset.userId || element.dataset.uid || '匿名用户';

        return {
          id,
          platform: 'bilibili',
          author: authorId, // Use extracted ID or default
          content,
          color,
          videoTime: parseFloat(videoTime.toFixed(3)), // Keep 3 decimal places for consistency
          timestamp: Date.now()
        };
    } catch (error) {
      console.error('解析 Bilibili 弹幕元素失败:', element, error); // Keep this log
      return null;
    }
  }

  // 移除旧的 captureDanmu 方法

  /**
   * 获取视频标题
   * @returns {string} 视频标题
   */
  getVideoTitle() {
    try {
      const titleElement = document.querySelector('h1.video-title');
      return titleElement ? titleElement.textContent.trim() : '未知视频';
    } catch (error) {
      console.error('获取B站视频标题失败:', error);
      return '未知视频';
    }
  }

  /**
   * 获取视频ID（BV号）
   * @returns {string} 视频ID（BV号）
   */
  getVideoId() {
    try {
      const pathname = window.location.pathname;
      const match = pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
      return match ? match[1] : '';
    } catch (error) {
      console.error('获取B站视频ID失败:', error);
      return '';
    }
  }
}

export default BilibiliAdapter; // 使用 export default
