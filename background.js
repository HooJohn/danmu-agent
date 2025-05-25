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
    // this.voiceEngine = null; // Will be assigned from danmuCore
    this.platformAdapter = null;
    this.timeSynchronizer = new TimeSynchronizer();
    this.highlightDetector = new HighlightDetector(); 
    this.settings = { ...DEFAULT_SETTINGS }; 
    this.isModelReady = false; 
    this.activeTabId = null; 
    this.isInitialized = false;

    // Use danmuCore's voice engine instance
    this.voiceEngine = danmuCore.voiceEngine; 
    if (!this.voiceEngine) {
        logger.error("VoiceEngine on danmuCore is not available at BackgroundWorker construction!");
        // Fallback or error handling if danmuCore's voiceEngine isn't ready,
        // though typically singletons are available upon import.
        // For now, we'll proceed, but operations on this.voiceEngine might fail if it's truly null.
    }
  }

  /**
   * Loads settings from chrome.storage.local.
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        const storedSettings = result[STORAGE_KEY];
        // Start with defaults, then overwrite with stored top-level keys
        this.settings = { ...DEFAULT_SETTINGS, ...storedSettings };
        // Specifically handle nested objects like aiFilterConfig for a deep merge
        if (storedSettings.aiFilterConfig) {
            this.settings.aiFilterConfig = { ...DEFAULT_SETTINGS.aiFilterConfig, ...storedSettings.aiFilterConfig };
        }
        // Ensure other nested objects, if any in future, are handled similarly.
        logger.info('Settings loaded from storage and merged with defaults:', this.settings);
      } else {
        logger.info('No settings found in storage, using defaults and saving them.');
        // Ensure this.settings still refers to a fresh copy of DEFAULT_SETTINGS here before saving
        this.settings = { ...DEFAULT_SETTINGS, aiFilterConfig: { ...DEFAULT_SETTINGS.aiFilterConfig } }; 
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
      // VoiceEngine is now assigned in constructor from danmuCore.
      // Ensure it's initialized here if its initialize method is separate and idempotent.
      if (this.voiceEngine && typeof this.voiceEngine.initialize === 'function') {
        // Assuming danmuCore.voiceEngine.initialize() has been called by DanmuCore's own init,
        // or it's safe to call multiple times. If not, this might need adjustment.
        // For now, let's ensure it's called to load voices if not already.
        await this.voiceEngine.initialize(); 
        logger.info('VoiceEngine (from danmuCore) re-checked/initialized in BackgroundWorker.');
      } else if (!this.voiceEngine) {
        logger.error("CRITICAL: VoiceEngine is not available on danmuCore during BackgroundWorker.initialize().");
        // Handle this case, perhaps by stopping initialization or using a stub.
        return; // Stop further initialization if voiceEngine is critical and missing.
      }

      // Apply initial settings to DanmuCore and its VoiceEngine
      danmuCore.setMode(this.settings.currentMode);
      danmuCore.setVoiceConfig({ 
          volume: this.settings.voiceVolume, 
          voiceName: this.settings.voiceName 
      });
      if (this.voiceEngine && typeof this.voiceEngine.setVoiceEnabled === 'function') {
          this.voiceEngine.setVoiceEnabled(this.settings.voiceEnabled);
      } else {
          logger.warn('VoiceEngine or setVoiceEnabled not available in initialize to set initial voice enabled state.');
      }
      
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
      
      this.setupTabListeners(); // Call setupTabListeners
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
            logger.info('AI Model loaded by worker. Sending initial AI filter config.');
            this.modelWorker.postMessage({
                type: 'update_config',
                config: this.settings.aiFilterConfig
            });

            // Ensure voice engine is fully initialized (voices loaded) before applying voice name
            if (this.voiceEngine && typeof this.voiceEngine.initialize === 'function') {
                // Assuming .initialize() is idempotent or handles multiple calls gracefully.
                // It's crucial that voices are loaded before trying to set a specific voice by name.
                this.voiceEngine.initialize().then(() => { 
                    logger.info('Voice engine fully initialized (voices loaded). Applying specific voice settings.');
                    // Re-apply voice config from settings, as specific voice might only be settable now
                    danmuCore.setVoiceConfig({ 
                        voiceName: this.settings.voiceName,
                        volume: this.settings.voiceVolume // Re-affirm volume
                    });
                    // Re-affirm enabled state
                    if (typeof this.voiceEngine.setVoiceEnabled === 'function') {
                         this.voiceEngine.setVoiceEnabled(this.settings.voiceEnabled);
                    }
                }).catch(err => logger.error("Error during voice engine full initialization for settings apply:", err));
            } else {
                 logger.warn('VoiceEngine or its initialize method not available post model load.');
            }
          } else {
            this.isModelReady = false;
            logger.error(`Model worker failed to load AI model: ${message}`);
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

  setupTabListeners() {
    chrome.tabs.onActivated.addListener(activeInfo => {
      this.activeTabId = activeInfo.tabId;
      logger.debug(`Active tab changed to: ${this.activeTabId}`);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tab.active && changeInfo.status === 'complete') {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          this.activeTabId = tabId;
          logger.debug(`Active tab updated and loaded: ${this.activeTabId}, URL: ${tab.url}`);
        }
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
           if (tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
              this.activeTabId = tabs[0].id;
              logger.debug(`Initial active tab: ${this.activeTabId}, URL: ${tabs[0].url}`);
           }
      }
    });
  }
} // This closing brace for BackgroundWorker class might be misplaced if setupTabListeners is outside.
// It should be inside the class. Let's assume the previous diff structure was correct and this is inside.
// The diff tool should handle placing it correctly if the search block is precise.

// The part below for initializing backgroundWorker is assumed to be outside the class definition.
// const backgroundWorker = new BackgroundWorker();
// backgroundWorker.initialize().then(() => {
// logger.info("BackgroundWorker initialization promise resolved.");
// }).catch(error => {
// logger.error("BackgroundWorker initialization failed:", error);
// });
// Re-pasting the end of the file correctly:
const backgroundWorker = new BackgroundWorker();
// initialize is async, top-level await is not allowed in service workers.
// Chrome handles this by keeping the worker alive until the promise resolves.
backgroundWorker.initialize().then(() => {
  logger.info("BackgroundWorker initialization promise resolved.");
}).catch(error => {
  logger.error("BackgroundWorker initialization failed:", error);
});
