/**
 * Danmu Agent - Background Service Worker
 *
 * 负责处理后台任务，例如：
 * - 初始化和管理 AI 模型 (通过 Web Worker)
 * - 处理来自 Content Script 和 Popup 的消息
 */

// 初始化日志工具
import { logger } from '../src/utils/logger.js';
// 导入平台检测模块
import { getPlatform, loadCurrentPlatformAdapter } from '../src/utils/platform.js';
// 导入语音引擎
import { initializeVoiceEngine } from '../src/voice/engine.js';

class BackgroundWorker {
  constructor() {
    this.modelWorker = null;
    this.voiceEngine = null;
    this.platformAdapter = null;
    this.isInitialized = false;
  }

  /**
   * 初始化后台服务
   */
  async initialize() {
    try {
      // 初始化语音引擎
      this.voiceEngine = initializeVoiceEngine();
      logger.info('语音引擎初始化成功');
      
      // 获取当前平台
      const platform = await getPlatform();
      logger.info(`检测到平台: ${platform}`);
      
      if (platform === 'unknown') {
        logger.warn('未知平台，停止初始化.');
        return;
      }

      // 加载平台适配器
      this.platformAdapter = await loadCurrentPlatformAdapter();
      logger.info(`平台适配器 (${platform}) 加载成功`);
      
      // 初始化模型 Worker
      this.initModelWorker();
      
      // 设置消息监听器
      this.setupMessageListeners();
      
      this.isInitialized = true;
      logger.info('Background Worker 初始化完成');
    } catch (error) {
      logger.error('Background Worker 初始化失败:', error);
    }
  }

  /**
   * 初始化模型 Worker
   */
  initModelWorker() {
    try {
      // 创建 Worker 实例
      this.modelWorker = new Worker('danmu-processor.js', { type: 'module' });
      logger.info('模型处理 Worker 初始化成功');

      this.modelWorker.onmessage = (event) => {
        const { type, data } = event.data;
        logger.debug(`收到来自 Model Worker 的消息: ${type}`, data);

        // 处理 Worker 消息
        if (type === 'processed_danmu') {
          // 将处理后的弹幕发送回 Content Script
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'display_danmu',
                data
              });
            }
          });
        }
      };

      this.modelWorker.onerror = (error) => {
        logger.error('模型 Worker 发生错误:', error.message);
      };

      this.modelWorker.postMessage({
        type: 'init',
        modelPath: 'models/qwen_omni_quantized.onnx'
      });

    } catch (error) {
      logger.error('初始化模型 Worker 失败:', error);
    }
  }

  /**
   * 设置消息监听器
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      logger.debug('收到消息:', message, '来自:', sender);

      const { type, data } = message;

      switch (type) {
        case 'request_danmu_process':
          // 请求弹幕处理
          if (this.modelWorker && data) {
            this.modelWorker.postMessage({
              type: 'process_danmu',
              danmuList: data
            });
          } else {
            logger.error('无效的弹幕数据或未初始化的模型 Worker');
          }
          break;

        case 'video_timeupdate':
          // 视频时间更新
          if (this.modelWorker && data && data.currentTime) {
            this.modelWorker.postMessage({
              type: 'time_update',
              currentTime: data.currentTime
            });
          }
          break;

        case 'video_seeked':
          // 视频跳转
          if (this.modelWorker && data && data.currentTime) {
            this.modelWorker.postMessage({
              type: 'seek_update',
              currentTime: data.currentTime
            });
          }
          break;

        case 'toggle_voice':
          // 开关语音播报
          if (this.voiceEngine) {
            if (data && data.enable !== undefined) {
              this.voiceEngine.setVoiceEnabled(data.enable);
            } else {
              this.voiceEngine.toggleVoice();
            }
          }
          break;

        case 'update_filter_config':
          // 更新过滤配置
          if (this.modelWorker && data) {
            this.modelWorker.postMessage({
              type: 'update_config',
              config: data
            });
          }
          break;

        default:
          logger.warn('未知消息类型:', type);
      }

      // 如果不需要异步发送响应，返回 false
      return false;
    });
  }
}

// 初始化 Background Worker
const backgroundWorker = new BackgroundWorker();
backgroundWorker.initialize();
