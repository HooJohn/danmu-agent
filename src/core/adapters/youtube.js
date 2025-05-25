// src/core/adapters/youtube.js

/**
 * YouTube平台弹幕适配器
 * 负责从YouTube视频页面抓取弹幕/评论
 */

import { DanmuAdapter } from './adapter-interface.js'; // 使用 import

class YouTubeAdapter extends DanmuAdapter {
  constructor() {
    super('youtube');
    this.danmuSelector = 'yt-live-chat-text-message-renderer'; // 选择器可能需要更新
    // this.interval = null; // 不再需要 interval
    this.observer = null; // 添加 MutationObserver 实例
    // YouTube Live Chat 容器选择器 (需要验证和更新, #items 可能在 iframe 内)
    this.danmuContainerSelector = 'yt-live-chat-renderer #items';
    this.callback = null; // 存储回调函数
    // this.lastProcessedTime = 0; // 时间处理逻辑可能需要调整
  }

  /**
   * 初始化适配器
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      // 检查当前页面是否为YouTube
      if (!window.location.hostname.includes('youtube.com')) {
        console.warn('当前页面不是YouTube，适配器初始化失败');
        return false;
      }
      
      console.log('YouTube弹幕适配器初始化成功');
      return true;
    } catch (error) {
      console.error('YouTube适配器初始化失败:', error);
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

    const targetNode = document.querySelector(this.danmuContainerSelector);
    if (!targetNode) {
      console.error(`YouTube 弹幕容器 (${this.danmuContainerSelector}) 未找到，无法启动 MutationObserver`);
      // 尝试延迟启动或给出更明确的错误
      // setTimeout(() => this.startCapture(callback), 2000); // 简单重试
      return;
    }

    // 配置 MutationObserver
    const config = { childList: true, subtree: true };

    // 创建一个观察器实例并传入回调函数
    this.observer = new MutationObserver((mutationsList, observer) => {
      this.handleMutations(mutationsList);
    });

    // 开始观察目标节点
    this.observer.observe(targetNode, config);
    console.log(`YouTube 适配器: MutationObserver 已启动，监听 ${this.danmuContainerSelector}`);

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
      console.log("YouTube 适配器: MutationObserver 已停止");
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
            if (node.matches && node.matches(this.danmuSelector)) {
              // 如果节点本身就是弹幕元素
              const danmu = this.parseDanmuElement(node);
              if (danmu) danmuList.push(danmu);
            } else {
              // 如果节点是容器，查找其下的弹幕元素
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
       console.log(`YouTube 适配器: 处理了 ${danmuList.length} 条已存在的弹幕`);
       this.callback(danmuList);
     }
  }


  /**
   * 解析单个弹幕 DOM 元素
   * @param {Element} element - 弹幕的 DOM 元素
   * @returns {object|null} 解析后的弹幕对象，如果解析失败则返回 null
   */
  parseDanmuElement(element) {
    try {
        // 获取弹幕ID，用于去重
        const id = element.id || Date.now() + Math.random().toString(36).substring(2, 9);

        // 获取弹幕文本内容 (选择器可能需要根据实际 YouTube 结构调整)
        const authorElement = element.querySelector('#author-name');
        const messageElement = element.querySelector('#message');

        if (!messageElement) return null; // 无法找到消息内容，跳过

        const author = authorElement ? authorElement.textContent.trim() : '匿名用户';
        const content = messageElement.textContent.trim();

        // 尝试从元素属性获取更精确的时间戳 (如果 YouTube 提供的话)
        // const videoTimeAttr = element.dataset.videoTime; // 假设有 data-video-time 属性
        // let videoTime = videoTimeAttr ? parseFloat(videoTimeAttr) : null;

        // 如果无法从元素获取时间，则使用当前视频时间作为备选
        // if (videoTime === null) {
          const videoElement = document.querySelector('video.html5-main-video'); // 更精确的选择器
          const currentTime = videoElement ? videoElement.currentTime : 0;
        //   videoTime = currentTime;
        // }

        // 创建弹幕对象
        return {
          id,
          platform: 'youtube',
          author,
          content,
          color: '#FFFFFF', // YouTube默认白色
          videoTime: currentTime, // 使用抓取时的时间，后续可能需要同步模块处理
          timestamp: Date.now()
        };
    } catch (error) {
      console.error('解析 YouTube 弹幕元素失败:', element, error);
      return null;
    }
  }

  // 移除旧的 captureDanmu 方法，因为它被 handleMutations 和 parseDanmuElement 替代了

  /**
   * 获取视频标题
   * @returns {string} 视频标题
   */
  getVideoTitle() {
    try {
      const titleElement = document.querySelector('h1.title');
      return titleElement ? titleElement.textContent.trim() : '未知视频';
    } catch (error) {
      console.error('获取YouTube视频标题失败:', error);
      return '未知视频';
    }
  }

  /**
   * 获取视频ID
   * @returns {string} 视频ID
   */
  getVideoId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('v') || '';
    } catch (error) {
      console.error('获取YouTube视频ID失败:', error);
      return '';
    }
  }
}

export default YouTubeAdapter; // 使用 export default
