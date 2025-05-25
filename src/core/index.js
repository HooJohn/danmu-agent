/**
 * Danmu-Agent 核心模块入口文件
 */

// 导入依赖模块
// import { setupMessageQueue } from './messageQueue.js'; // Removed as per task
import { logger } from '../utils/logger.js';
import { basicFilter, platformFilter, vulgarityFilter, educationContentFilter } from './filter.js'; // Added new filters
import { TimeSynchronizer } from './sync.js';

// 初始化语音引擎
import { initializeVoiceEngine } from '../voice/engine.js';
import { applyPlatformPreset } from '../voice/voices.js'; // Added import

// AI-related imports are removed as scoring is now handled by the worker

class DanmuCore {
  constructor() {
    // 初始化日志
    this.logger = logger;
    
    // 初始化消息队列 - Removed as per task
    // this.danmuQueue = setupMessageQueue(); 
    
    // 初始化时间同步
    this.timeSynchronizer = new TimeSynchronizer();
    
    // 初始化语音引擎
    this.voiceEngine = initializeVoiceEngine();
    this.currentMode = 'default'; // Initialize currentMode
    
    // Thresholds below are kept for now, but their direct usage in processDanmu was removed.
    // They might be used by other parts or if AI worker sends raw scores that DanmuCore needs to evaluate.
    // If they are truly no longer needed anywhere, they can be removed in a future cleanup.
    this.interestingnessThreshold = 0.6;
    this.relevanceThreshold = 0.5;
    this.sentimentFilter = null; // null表示不过滤情感, 1 for positive, -1 for negative
    
    // llmConfig is removed
    
    this.logger.info('Danmu Core 模块初始化完成');
  }

  /**
   * Sets the operating mode for DanmuCore.
   * @param {string} mode - The mode to set (e.g., 'default', 'movie', 'education').
   */
  setMode(mode) {
    this.currentMode = mode;
    this.logger.info(`DanmuCore mode set to: ${this.currentMode}`);
    // Apply voice preset based on mode. Assumes preset names match mode names.
    this.applyVoicePreset(this.currentMode); 
  }

  // initializeAI, getAIConfig, and isAIServiceInitialized methods are removed

  /**
   * 处理单条弹幕
   * @param {Object} danmu 弹幕对象
   * @returns {Object|null} 处理后的弹幕或null（如果被过滤）
   */
  processDanmu(danmu) {
    // 基本过滤
    if (!basicFilter(danmu)) {
      // basicFilter already logs the reason
      return null;
    }
    
    // 平台专属过滤
    // danmu.platform should be provided by the adapter
    if (!platformFilter(danmu, danmu.platform)) {
      // platformFilter already logs the reason
      return null;
    }
    
    // The AI-based scoring (interestingness, relevance, sentiment) and subsequent filtering
    // based on those scores are now assumed to be handled by the AI worker 
    // (danmu-processor.js) before DanmuCore receives the danmu.
    // Thus, the old AI score-based threshold and sentiment filtering logic was removed from here.

    // Mode-specific filtering
    switch (this.currentMode) {
      case 'movie':
        if (!vulgarityFilter(danmu)) { // Assuming default word list for now
          // vulgarityFilter logs the reason
          return null;
        }
        break;
      case 'education':
        if (!educationContentFilter(danmu)) {
          // educationContentFilter logs the reason
          return null;
        }
        break;
      // Default mode has no additional content filters here beyond basic/platform.
    }

    // If the danmu passed all applicable filters, return it.
    return danmu;
  }

  /**
   * 批量处理弹幕
   * @param {Array} danmuList 弹幕列表 (expected to have scores from the worker)
   * @returns {Array} 过滤后的弹幕列表
   */
  async batchProcess(danmuList) {
    if (!Array.isArray(danmuList) || danmuList.length === 0) {
      return [];
    }
    
    // AI scoring is now done in the worker.
    // This method now primarily applies filtering based on scores already present.
    return danmuList
      .map(danmu => this.processDanmu(danmu))
      .filter(danmu => danmu !== null);
  }

  /**
   * 设置过滤阈值
   * @param {Object} config 过滤配置
   */
  setFilterConfig(config) {
    if (config.interestingnessThreshold !== undefined) {
      this.interestingnessThreshold = config.interestingnessThreshold;
    }
    
    if (config.relevanceThreshold !== undefined) {
      this.relevanceThreshold = config.relevanceThreshold;
    }
    
    if (config.sentimentFilter !== undefined) {
      this.sentimentFilter = config.sentimentFilter;
    }
    
    this.logger.info('过滤配置已更新:', {
      interestingnessThreshold: this.interestingnessThreshold,
      relevanceThreshold: this.relevanceThreshold,
      sentimentFilter: this.sentimentFilter
    });
  }

  /**
   * 获取当前过滤配置
   * @returns {Object} 当前配置
   */
  getFilterConfig() {
    return {
      interestingnessThreshold: this.interestingnessThreshold,
      relevanceThreshold: this.relevanceThreshold,
      sentimentFilter: this.sentimentFilter
    };
  }

  /**
   * 获取当前语音配置
   * @returns {Object} 语音配置
   */
  getVoiceConfig() {
    return {
      voice: this.voiceEngine?.selectedVoice?.name || 'default',
      rate: this.voiceEngine?.rate || 1.0,
      pitch: this.voiceEngine?.pitch || 1.0,
      volume: this.voiceEngine?.volume || 0.8
    };
  }

  /**
   * 设置语音配置
   * @param {Object} config 语音配置
   */
  setVoiceConfig(config) {
    if (this.voiceEngine && config) {
      // Set rate, pitch, volume
      this.voiceEngine.setParams({ 
        rate: config.rate, 
        pitch: config.pitch, 
        volume: config.volume 
      });

      // Set specific voice by name if provided
      if (config.voiceName) {
        this.voiceEngine.setVoice(config.voiceName);
      }
      this.logger.info('语音配置已更新:', config);
    }
  }

  /**
   * Applies a platform-specific voice preset.
   * @param {string} platform - The platform identifier (e.g., 'bilibili', 'youtube').
   */
  applyVoicePreset(platform) {
    if (this.voiceEngine) {
      applyPlatformPreset(this.voiceEngine, platform);
      this.logger.info(`语音预设已应用于平台: ${platform}`);
    } else {
      this.logger.warn('尝试应用语音预设但语音引擎未初始化。');
    }
  }
}

// 创建核心实例
const danmuCore = new DanmuCore();

// 导出核心模块
export { DanmuCore, danmuCore };
