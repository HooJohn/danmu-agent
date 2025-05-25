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
// 导入时间同步器
import { TimeSynchronizer } from '../src/core/sync.js';
// Import danmuCore for accessing its voiceEngine instance if needed,
// however, BackgroundWorker already has its own this.voiceEngine.
// For this task, we will use BackgroundWorker's own this.voiceEngine.
// import { danmuCore } from '../core/index.js'; 

class BackgroundWorker {
  constructor() {
    this.modelWorker = null;
    this.voiceEngine = null;
    this.platformAdapter = null;
    this.timeSynchronizer = new TimeSynchronizer(); // Instantiate TimeSynchronizer
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
      const workerUrl = chrome.runtime.getURL('worker/danmu-processor.js');
      this.modelWorker = new Worker(workerUrl, { type: 'module' });
      logger.info('模型处理 Worker 初始化成功');

      this.modelWorker.onmessage = (event) => {
        const { type, data, success, message } = event.data; // Added success and message for error handling
        logger.debug(`收到来自 Model Worker 的消息: ${type}`, event.data);

        // 处理 Worker 消息
        if (type === 'model_loaded') {
          if (success) {
            logger.info('模型 Worker 报告模型加载成功。');
            // Send initial filter configuration
            const defaultConfig = {
              interestingnessThreshold: 0.6,
              relevanceThreshold: 0.5,
              sentimentFilter: null
            };
            this.modelWorker.postMessage({
              type: 'update_config',
              config: defaultConfig
            });
            logger.info('已发送初始配置到 Model Worker:', defaultConfig);
          } else {
            logger.error(`模型 Worker 报告模型加载失败: ${message}`);
          }
        } else if (type === 'config_updated') {
          if (success) {
            logger.info('模型 Worker 确认配置更新:', data);
          } else {
            logger.error(`模型 Worker 报告配置更新失败: ${message}`);
          }
        } else if (type === 'processed_danmu') {
          // Add processed danmu to TimeSynchronizer instead of sending directly
          if (Array.isArray(data)) {
            data.forEach(danmu => {
              this.timeSynchronizer.addDanmu(danmu);
            });
            logger.debug(`Added ${data.length} processed danmu to TimeSynchronizer cache.`);
          } else {
            logger.warn("Received 'processed_danmu' with non-array data:", data);
          }
          // Displaying will now be handled by 'video_timeupdate'
        } else if (type === 'error') {
          logger.error(`模型 Worker 报告错误: ${message}`);
        }
      };

      this.modelWorker.onerror = (error) => {
        logger.error('模型 Worker 发生错误:', error.message, error);
      };

      // Send init message with dynamically resolved model path
      const modelPathUrl = chrome.runtime.getURL('models/qwen_omni_quantized.onnx');
      this.modelWorker.postMessage({
        type: 'init',
        modelPath: modelPathUrl
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
              data: data // Changed from danmuList: data
            });
          } else {
            logger.error('无效的弹幕数据或未初始化的模型 Worker');
          }
          break;

        case 'video_timeupdate':
          // 视频时间更新 - Use TimeSynchronizer
          if (data && typeof data.currentTime === 'number') {
            this.timeSynchronizer.processAtTime(data.currentTime, (danmuToDisplay) => {
              // Send to content script for display
              if (danmuToDisplay && danmuToDisplay.length > 0) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  if (tabs.length > 0 && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      type: 'display_danmu',
                      data: danmuToDisplay
                    }, () => {
                      if (chrome.runtime.lastError) {
                        logger.error("Error sending display_danmu message:", chrome.runtime.lastError.message);
                      }
                    });
                  } else {
                    logger.warn("No active tab found or tab ID missing for sending display_danmu.");
                  }
                });

                // Speak the danmu content
                if (this.voiceEngine && this.voiceEngine.initialized) {
                  danmuToDisplay.forEach(danmu => {
                    if (danmu && danmu.content) {
                      logger.debug(`Background: Requesting speech for danmu: "${danmu.content.substring(0,30)}"`);
                      this.voiceEngine.speak(danmu.content); 
                      // Optional: Apply platform preset before speaking
                      // if (danmu.platform && danmuCore) { // danmuCore would need to be available here
                      //   danmuCore.applyVoicePreset(danmu.platform);
                      // }
                    }
                  });
                } else {
                  logger.warn("VoiceEngine not available or not initialized, cannot speak danmu.");
                }
              }
            });
          } else {
            logger.warn("Invalid 'video_timeupdate' data received:", data);
          }
          break;

        case 'video_seeked':
          // 视频跳转 - Use TimeSynchronizer
          if (data && typeof data.currentTime === 'number') {
            this.timeSynchronizer.handleSeek(data.currentTime);
            logger.info(`Video seeked to: ${data.currentTime}, TimeSynchronizer updated.`);
          } else {
            logger.warn("Invalid 'video_seeked' data received:", data);
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
