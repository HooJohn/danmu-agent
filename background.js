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
// 导入 HighlightDetector
import { HighlightDetector } from '../src/core/highlightDetector.js';
// 导入 danmuCore 实例
import { danmuCore } from '../src/core/index.js'; 

const STORAGE_KEY = 'danmuAgentSettings';
const DEFAULT_SETTINGS = {
  currentMode: 'default',
  aiFilterConfig: {
    interestingnessThreshold: 0.6,
    relevanceThreshold: 0.5,
    sentimentFilter: null // 'null', 1 for positive, -1 for negative
  },
  voiceEnabled: false,
  voiceVolume: 0.8,
  voiceName: null
};

class BackgroundWorker {
  constructor() {
    this.modelWorker = null;
    this.voiceEngine = null;
    this.platformAdapter = null;
    this.timeSynchronizer = new TimeSynchronizer();
    this.highlightDetector = new HighlightDetector();
    this.settings = { ...DEFAULT_SETTINGS }; // Initialize with default settings
    this.isModelReady = false; // Flag for AI model readiness
    this.isInitialized = false;
  }

  /**
   * Loads settings from chrome.storage.local.
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        // Merge loaded settings with defaults to ensure all keys are present
        this.settings = { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] };
        // Ensure nested objects like aiFilterConfig are also merged properly
        if (result[STORAGE_KEY].aiFilterConfig) {
            this.settings.aiFilterConfig = { ...DEFAULT_SETTINGS.aiFilterConfig, ...result[STORAGE_KEY].aiFilterConfig };
        }
        logger.info('Settings loaded from storage:', this.settings);
      } else {
        logger.info('No settings found in storage, using defaults and saving them.');
        await chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
    }
  }

  /**
   * 初始化后台服务
   */
  async initialize() {
    await this.loadSettings(); // Load settings first

    try {
      // 初始化语音引擎
      this.voiceEngine = initializeVoiceEngine({ volume: this.settings.voiceVolume });
      // Assuming VoiceEngine's initialize method loads voices and then we can set voiceEnabled
      // This part of setting voice name and enabled status will be more robust after model_loaded or voice engine signals readiness
      logger.info('语音引擎初步配置应用完毕。等待完整初始化...');
      
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
      this.initModelWorker(); // This will eventually trigger sending AI config and other settings
      
      // 设置消息监听器
      this.setupMessageListeners();

      // Apply other settings that don't depend on model worker readiness
      danmuCore.setMode(this.settings.currentMode); 
      // Voice name and enabled status applied more robustly after voice engine and model worker are ready
      
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
            this.isModelReady = true;
            logger.info('Model loaded by worker. Sending initial AI filter config.');
            this.modelWorker.postMessage({
                type: 'update_config',
                config: this.settings.aiFilterConfig
            });
            
            // Apply other initial settings to danmuCore and voiceEngine
            danmuCore.setMode(this.settings.currentMode); // Redundant if already set in initialize, but safe
            
            // Ensure voice engine is fully initialized before setting voice name and enabled status
            this.voiceEngine.initialize().then(() => {
                logger.info('Voice engine fully initialized. Applying stored voice settings.');
                if (this.settings.voiceName) {
                    danmuCore.setVoiceConfig({ voiceName: this.settings.voiceName });
                }
                if (typeof this.voiceEngine.setVoiceEnabled === 'function') {
                    this.voiceEngine.setVoiceEnabled(this.settings.voiceEnabled);
                } else {
                    logger.warn('this.voiceEngine.setVoiceEnabled is not a function.');
                }
                 // Volume was set at VoiceEngine construction, ensure it's correct
                danmuCore.setVoiceConfig({ volume: this.settings.voiceVolume });
            }).catch(err => logger.error("Error during voice engine full initialization for settings apply:", err));

          } else {
            this.isModelReady = false;
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
              // Also pass to HighlightDetector
              if (danmu.timestamp && danmu.scores) { // Ensure necessary fields are present
                this.highlightDetector.addDanmu(danmu);
              } else {
                logger.warn("Danmu missing timestamp or scores for HighlightDetector:", danmu);
              }
            });
            logger.debug(`Added ${data.length} processed danmu to TimeSynchronizer and HighlightDetector.`);
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

        case 'TOGGLE_VOICE_ENABLED': {
          const newState = (data && data.enable !== undefined) ? data.enable : !this.settings.voiceEnabled;
          this.settings.voiceEnabled = newState;
          if (this.voiceEngine && typeof this.voiceEngine.setVoiceEnabled === 'function') {
            this.voiceEngine.setVoiceEnabled(newState);
          } else {
            logger.warn('VoiceEngine or setVoiceEnabled not available for TOGGLE_VOICE_ENABLED.');
          }
          chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
          logger.info('Voice enabled set to:', newState);
          // Inform popup of the change so UI can update
          chrome.runtime.sendMessage({ type: 'CURRENT_SETTINGS_RESPONSE', data: await this.getCurrentSettingsForPopup() });
          break;
        }

        case 'SET_VOLUME':
          if (data && data.volume !== undefined) {
            this.settings.voiceVolume = data.volume;
            danmuCore.setVoiceConfig({ volume: data.volume });
            chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
            logger.info('Volume set to:', data.volume);
          }
          break;

        case 'SET_VOICE_NAME':
          if (data && data.voiceName) {
            this.settings.voiceName = data.voiceName;
            danmuCore.setVoiceConfig({ voiceName: data.voiceName });
            chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
            logger.info('Voice name set to:', data.voiceName);
          }
          break;
        
        case 'GET_VOICE_LIST':
          if (danmuCore.voiceEngine) {
             // Ensure voice engine is initialized and voices loaded
            (async () => {
              if (!danmuCore.voiceEngine.initialized) {
                await danmuCore.voiceEngine.initialize(); // Ensure initialization
              }
              const voices = danmuCore.voiceEngine.getVoices().map(v => ({ name: v.name, lang: v.lang, default: v.default }));
              sendResponse({ type: 'VOICE_LIST_RESPONSE', data: voices });
            })();
          } else {
            sendResponse({ type: 'VOICE_LIST_RESPONSE', data: [] });
          }
          return true; // Indicates asynchronous response

        case 'GET_CURRENT_SETTINGS':
          (async () => {
            const settingsForPopup = await this.getCurrentSettingsForPopup();
            sendResponse(settingsForPopup);
          })();
          return true; // Indicates asynchronous response
        
        case 'UPDATE_AI_FILTER_CONFIG':
          if (data) {
            this.settings.aiFilterConfig = { ...this.settings.aiFilterConfig, ...data };
            if (this.modelWorker && this.isModelReady) {
              this.modelWorker.postMessage({
                type: 'update_config',
                config: this.settings.aiFilterConfig
              });
            }
            chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
            logger.info('AI Filter Config updated:', this.settings.aiFilterConfig);
          }
          break;
        
        case 'SET_MODE':
          if (data && data.mode) {
            this.settings.currentMode = data.mode;
            danmuCore.setMode(data.mode);
            chrome.storage.local.set({ [STORAGE_KEY]: this.settings });
            logger.info('Mode set to:', data.mode);
            // Inform popup of the change so UI can update
            (async () => {
                chrome.runtime.sendMessage({ type: 'CURRENT_SETTINGS_RESPONSE', data: await this.getCurrentSettingsForPopup() });
            })();
          } else {
            logger.warn("Invalid 'SET_MODE' data received:", data);
          }
          break;

        default:
          logger.warn('未知消息类型:', type);
      }
      // Ensure all paths either return false or true if sendResponse is async
      if (['GET_CURRENT_SETTINGS', 'GET_VOICE_LIST'].includes(type)) {
         // Already handled by return true in their blocks
      } else {
        // For other messages, if no async operation, ensure settings are saved if modified
      }
      return false; 
    });
  }

  async getCurrentSettingsForPopup() {
    const currentSettings = { ...this.settings };
    if (danmuCore.voiceEngine && danmuCore.voiceEngine.initialized) {
      currentSettings.voiceEnabled = typeof danmuCore.voiceEngine.isVoiceEnabled === 'function' ? 
                                         danmuCore.voiceEngine.isVoiceEnabled() : 
                                         this.settings.voiceEnabled;
      const currentSelectedVoice = danmuCore.voiceEngine.selectedVoice;
      currentSettings.voiceName = currentSelectedVoice ? currentSelectedVoice.name : this.settings.voiceName;
      currentSettings.voiceVolume = danmuCore.voiceEngine.volume !== undefined ? 
                                        danmuCore.voiceEngine.volume : 
                                        this.settings.voiceVolume;
    }
    // Include aiFilterConfig directly from this.settings
    currentSettings.aiFilterConfig = { ...this.settings.aiFilterConfig };
    return currentSettings;
  }
}

// 初始化 Background Worker
const backgroundWorker = new BackgroundWorker();
// initialize is async, top-level await is not allowed in service workers.
// Chrome handles this by keeping the worker alive until the promise resolves.
backgroundWorker.initialize().then(() => {
  logger.info("BackgroundWorker initialization promise resolved.");
}).catch(error => {
  logger.error("BackgroundWorker initialization failed:", error);
});
