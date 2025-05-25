/**
 * Danmu-Agent 核心模块入口文件
 */

// 导入依赖模块
import { setupMessageQueue } from './messageQueue.js';
import { logger } from '../utils/logger.js';
import { basicFilter, platformFilter } from './filter.js';
import { TimeSynchronizer } from './sync.js';

// 初始化语音引擎
import { initializeVoiceEngine } from '../voice/engine.js';

// AI-related imports are removed as scoring is now handled by the worker

class DanmuCore {
  constructor() {
    // 初始化日志
    this.logger = logger;
    
    // 初始化消息队列
    this.danmuQueue = setupMessageQueue();
    
    // 初始化时间同步
    this.timeSynchronizer = new TimeSynchronizer();
    
    // 初始化语音引擎
    this.voiceEngine = initializeVoiceEngine();
    
    // 设置过滤器
    this.interestingnessThreshold = 0.6;
    this.relevanceThreshold = 0.5;
    this.sentimentFilter = null; // null表示不过滤情感, 1 for positive, -1 for negative
    
    // llmConfig is removed
    
    this.logger.info('Danmu Core 模块初始化完成');
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
      return null;
    }
    
    // 平台专属过滤
    const filtered = platformFilter(danmu, danmu.platform);
    if (!filtered) {
      return null;
    }
    
    // 情感过滤
    if (this.sentimentFilter !== null && danmu.scores && danmu.scores.sentiment !== undefined) {
      const isPositive = danmu.scores.sentiment > 0.5;
      const shouldKeepPositive = this.sentimentFilter > 0;
      
      if (isPositive !== shouldKeepPositive) {
        return null;
      }
    }
    
    // 应用过滤阈值
    // Ensure scores exist before trying to access them
    if (danmu.scores && danmu.scores.interestingness !== undefined && danmu.scores.relevance !== undefined) {
      const { interestingness, relevance } = danmu.scores;
      
      if (interestingness < this.interestingnessThreshold ||
          relevance < this.relevanceThreshold) {
        return null;
      }
    } else {
      // If there are no scores, and thresholds are set, we might want to filter them out
      // or handle them as "not scored". For now, let's assume if scores are missing,
      // they don't pass threshold checks if thresholds are non-zero.
      // This behavior might need adjustment based on desired UX.
      if (this.interestingnessThreshold > 0 || this.relevanceThreshold > 0) {
        // this.logger.debug('Danmu filtered due to missing scores and active thresholds:', danmu);
        return null; 
      }
    }
    
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
      this.voiceEngine.setParams(config);
      this.logger.info('语音配置已更新:', config);
    }
  }
}

// 创建核心实例
const danmuCore = new DanmuCore();

// 导出核心模块
export { DanmuCore, danmuCore };
