/**
 * Danmu Agent - Content Script
 *
 * 负责与页面 DOM 交互，例如：
 * - 检测当前视频平台
 * - 查找视频播放器元素
 * - 抓取页面上的弹幕元素 (DOM 操作)
 * - 将抓取到的原始弹幕发送给 Background Script 处理
 * - 接收来自 Background Script 处理后的弹幕并显示 (如果需要在此处显示)
 * - 监听视频播放事件 (播放、暂停、跳转) 并通知 Background Script
 * - 注入 UI 元素 (如果需要直接在页面上添加控件)
 */

// Import necessary modules
import { getPlatform, loadCurrentPlatformAdapter } from '../utils/platform.js';
import { initializeVoiceEngine } from '../voice/engine.js';

// --- 全局变量与状态 ---
let currentPlatform = null;
let videoElement = null;
// let danmuProcessor = null; // Not used in this refactor
let platformAdapter = null; // 当前平台的适配器实例
let voiceEngine = null; // 语音引擎实例

// --- 初始化 ---
/**
 * 初始化 Content Script
 */
async function initializeContentScript() {
  console.log("初始化 Content Script...");
  
  // 1. 检测平台
  currentPlatform = await getPlatform();
  console.log("检测到平台:", currentPlatform);
  
  if (currentPlatform === 'unknown') {
    console.log("未知平台，停止初始化.");
    return;
  }
  
  // 2. 等待页面加载完成或特定元素出现
  //    对于动态加载内容的网站，可能需要 MutationObserver
  try {
    videoElement = await waitForVideoElement(currentPlatform);
    console.log("视频元素已找到:", videoElement);
    
    // 3. 加载平台适配器
    platformAdapter = await loadCurrentPlatformAdapter();
    console.log(`平台适配器 (${currentPlatform}) 已加载`);

    // 3.1 Initialize platform adapter if it has an init method
    if (platformAdapter && typeof platformAdapter.initialize === 'function') {
      console.log(`Initializing platform adapter (${currentPlatform})...`);
      await platformAdapter.initialize();
      console.log(`Platform adapter (${currentPlatform}) initialized.`);
    }
    
    // 4. 初始化语音引擎
    voiceEngine = initializeVoiceEngine(); // Assuming this is synchronous or handles its own async
    
    // 5. 初始化弹幕抓取和处理逻辑
    startDanmuProcessing();
    
    // 6. 设置视频播放相关事件监听器
    setupVideoEventListeners();
    
    console.log("Content Script 初始化完成.");
  } catch (error) {
    console.error("初始化失败:", error);
  }
}

/**
 * 等待视频元素加载完成
 * @param {string} platform - 当前平台标识
 * @returns {Promise<HTMLVideoElement>}
 */
function waitForVideoElement(platform) {
  return new Promise((resolve, reject) => {
    const selector = getVideoSelector(platform); // 需要实现 getVideoSelector
    if (!selector) {
      return reject(new Error(`平台 ${platform} 的视频选择器未定义`));
    }

    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        resolve(element);
      }
    }, 500); // 每 500ms 检查一次

    // 设置超时，例如 30 秒
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`查找视频元素超时 (${selector})`));
    }, 30000);
  });
}

/**
 * 根据平台获取视频元素的选择器
 * @param {string} platform
 * @returns {string|null}
 */
function getVideoSelector(platform) {
  switch (platform) {
    case 'youtube':
      return 'video.html5-main-video';
    case 'bilibili':
      return 'video.bpx-player-video-element'; // 可能需要更新
    case 'netflix':
      return 'video'; // 可能需要更精确的选择器
    // 添加其他平台...
    default:
      return null;
  }
}

// --- 弹幕处理 ---

/**
 * 开始弹幕抓取和处理循环
 */
function startDanmuProcessing() {
  console.log("开始弹幕处理...");
  if (platformAdapter && typeof platformAdapter.startCapture === 'function') {
    platformAdapter.startCapture(handleCapturedDanmu);
    console.log("弹幕抓取已通过平台适配器启动。");
  } else {
    console.error("平台适配器或 startCapture 方法未定义，无法启动弹幕抓取。");
  }
}

/**
 * 处理由平台适配器抓取到的弹幕列表
 * @param {Array<Object>} danmuList - 从适配器接收到的弹幕对象列表
 */
function handleCapturedDanmu(danmuList) {
  if (danmuList && danmuList.length > 0) {
    console.log(`Content Script: 收到 ${danmuList.length} 条弹幕从适配器, 发送给 background...`);
    chrome.runtime.sendMessage({ type: 'request_danmu_process', data: danmuList }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Content Script: 发送消息给 Background Script 失败:", chrome.runtime.lastError.message);
      } else {
        // Optional: console.log("Content Script: 收到 Background Script 的响应:", response);
      }
    });
  }
}

// fetchAndSendDanmu function is removed.

// --- 事件监听 ---

/**
 * 设置视频播放相关事件监听器
 */
function setupVideoEventListeners() {
  if (!videoElement) return;

  videoElement.addEventListener('timeupdate', handleTimeUpdate);
  videoElement.addEventListener('seeked', handleSeeked);
  videoElement.addEventListener('play', handlePlay);
  videoElement.addEventListener('pause', handlePause);
}

function handleTimeUpdate() {
  const currentTime = videoElement.currentTime;
  // 可以将当前时间发送给 Background Script 用于同步
  // Note: Sending on every timeupdate can be frequent. Consider throttling for performance.
  chrome.runtime.sendMessage({ type: 'video_timeupdate', data: { currentTime } });
  // console.log("Time update:", currentTime); // 避免过于频繁的日志
}

function handleSeeked() {
  const currentTime = videoElement.currentTime;
  console.log("视频跳转到:", currentTime);
  // 通知 Background Script 处理跳转
  chrome.runtime.sendMessage({ type: 'video_seeked', data: { currentTime } });
}

function handlePlay() {
  console.log("视频播放");
  // chrome.runtime.sendMessage({ type: 'video_play' });
}

function handlePause() {
  console.log("视频暂停");
  // chrome.runtime.sendMessage({ type: 'video_pause' });
}

// --- 消息接收 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 注意：Content Script 无法直接访问 Background Script 的 sender 对象
  console.log("Content Script 收到消息:", message);
  const { type, data } = message;

  switch (type) {
    case 'display_danmu':
      // 处理来自 Background Script 的、经过筛选和处理的弹幕
      // 例如，将其显示在页面上
      console.log("需要显示弹幕:", data);
      // displayDanmuOnPage(data); // 需要实现此函数
      break;
    // 添加其他消息处理...
    default:
      console.warn("Content Script 未知消息类型:", type);
  }
  // sendResponse({ received: true }); // 可以选择性地发送响应
});
