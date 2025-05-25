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
    // B站弹幕容器选择器 (需要验证和更新, 可能是播放器根元素或弹幕层)
    this.danmuContainerSelector = '.bpx-player-video-area .bpx-player-sending-area'; // 猜测的选择器
    this.callback = null; // 存储回调函数
    // this.lastProcessedTime = 0; // 时间处理逻辑可能需要调整
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

    // B站弹幕容器可能比较复杂，这个选择器需要仔细验证
    const targetNode = document.querySelector(this.danmuContainerSelector);
    if (!targetNode) {
      console.error(`Bilibili 弹幕容器 (${this.danmuContainerSelector}) 未找到，无法启动 MutationObserver`);
      // 尝试查找 B站播放器根元素作为备选
      const playerRoot = document.querySelector('.bpx-player-container');
      if (playerRoot) {
         console.log("尝试监听 B站播放器根元素:", playerRoot);
         this.observer = new MutationObserver((mutationsList) => this.handleMutations(mutationsList));
         this.observer.observe(playerRoot, { childList: true, subtree: true });
         console.log(`Bilibili 适配器: MutationObserver 已启动，监听播放器根元素`);
         this.processExistingDanmu(playerRoot); // 初始处理
      } else {
         console.error("也未能找到 B站播放器根元素，无法启动监听");
         return; // 彻底失败
      }
    } else {
       // 配置 MutationObserver
       const config = { childList: true, subtree: true }; // 监听子节点变化

       // 创建一个观察器实例并传入回调函数
       this.observer = new MutationObserver((mutationsList) => this.handleMutations(mutationsList));

       // 开始观察目标节点
       this.observer.observe(targetNode, config);
       console.log(`Bilibili 适配器: MutationObserver 已启动，监听 ${this.danmuContainerSelector}`);

       // 初始抓取一次已存在的弹幕
       this.processExistingDanmu(targetNode);
    }
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
        // 获取弹幕ID，用于去重 (B站可能有 data-dm-id 或类似属性)
        const id = element.dataset.id || element.getAttribute('id') || Date.now() + Math.random().toString(36).substring(2, 9);

        // 获取弹幕文本内容
        const content = element.textContent ? element.textContent.trim() : '';
        if (!content) return null; // 没有内容则跳过

        // 获取弹幕颜色
        const color = element.style.color || '#FFFFFF'; // 默认为白色

        // 尝试获取弹幕在视频中的时间 (B站可能通过 data 属性或计算得出)
        // const videoTimeAttr = element.dataset.time;
        // let videoTime = videoTimeAttr ? parseFloat(videoTimeAttr) : null;

        // 备选：使用当前视频时间
        // if (videoTime === null) {
          const videoElement = document.querySelector('video.bpx-player-video-element'); // B站视频选择器
          const currentTime = videoElement ? videoElement.currentTime : 0;
        //   videoTime = currentTime;
        // }

        // 创建弹幕对象
        return {
          id,
          platform: 'bilibili',
          author: '匿名用户', // B站通常不显示发送者
          content,
          color,
          videoTime: currentTime, // 使用抓取时的时间，后续可能需要同步模块处理
          timestamp: Date.now()
        };
    } catch (error) {
      console.error('解析 Bilibili 弹幕元素失败:', element, error);
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
