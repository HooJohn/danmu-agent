/**
 * 弹幕AI评分系统
 * 使用云端LLM服务对弹幕进行智能评分
 */

import LLMServiceManager from './model.js';

// 创建LLM服务管理器单例
let llmServiceInstance = null;

/**
 * 获取LLM服务管理器实例
 * @returns {LLMServiceManager} LLM服务管理器实例
 */
function getLLMService() {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMServiceManager();
  }
  return llmServiceInstance;
}

/**
 * 初始化AI评分系统
 * @param {Object} config LLM服务配置
 * @returns {Promise<boolean>} 初始化是否成功
 */
async function initializeScoring(config) {
  try {
    console.log('正在初始化AI评分系统...');
    
    // 初始化LLM服务
    const llmService = getLLMService();
    const success = await llmService.initialize(config);
    
    if (!success) {
      console.error('LLM服务初始化失败:', llmService.getLastError());
      return false;
    }
    
    console.log('AI评分系统初始化成功');
    return true;
  } catch (error) {
    console.error('初始化AI评分系统失败:', error);
    return false;
  }
}

/**
 * 评分单条弹幕内容
 * @param {string} text 弹幕文本
 * @returns {Promise<Object>} 评分结果
 */
async function scoreDanmu(text) {
  try {
    const llmService = getLLMService();
    
    if (!llmService.isServiceReady()) {
      throw new Error('AI评分系统未正确初始化');
    }
    
    return await llmService.scoreDanmu(text);
  } catch (error) {
    console.error('弹幕评分失败:', error);
    // 返回默认评分
    return {
      sentiment: 0.5,       // 中性
      interestingness: 0.5,  // 一般趣味度
      relevance: 0.5        // 一般相关性
    };
  }
}

/**
 * 批量处理弹幕列表
 * @param {Array} danmuList 弹幕列表
 * @returns {Promise<Array>} 处理后的弹幕列表
 */
async function processDanmuList(danmuList) {
  try {
    const llmService = getLLMService();
    
    if (!llmService.isServiceReady()) {
      throw new Error('AI评分系统未正确初始化');
    }
    
    return await llmService.batchProcess(danmuList);
  } catch (error) {
    console.error('批量弹幕处理失败:', error);
    // 出错时返回原始列表，但添加默认评分
    return danmuList.map(danmu => ({
      ...danmu,
      scores: {
        sentiment: 0.5,
        interestingness: 0.5,
        relevance: 0.5
      }
    }));
  }
}

/**
 * 根据评分阈值过滤弹幕
 * @param {Array} scoredDanmuList 已评分的弹幕列表
 * @param {Object} thresholds 过滤阈值配置
 * @returns {Array} 过滤后的弹幕列表
 */
function filterByScores(scoredDanmuList, thresholds = {}) {
  const {
    minInterestingness = 0.4,   // 默认趣味度阈值
    minRelevance = 0.3,         // 默认相关性阈值
    sentimentFilter = null      // 情感过滤（null表示不过滤）
  } = thresholds;
  
  return scoredDanmuList.filter(danmu => {
    // 如果没有评分数据，默认保留
    if (!danmu.scores) return true;
    
    const { sentiment, interestingness, relevance } = danmu.scores;
    
    // 趣味度过滤
    if (interestingness < minInterestingness) return false;
    
    // 相关性过滤
    if (relevance < minRelevance) return false;
    
    // 情感过滤（如果设置了）
    if (sentimentFilter !== null) {
      // sentimentFilter为正表示保留积极情感，为负表示保留消极情感
      if (sentimentFilter > 0 && sentiment < 0.5) return false;
      if (sentimentFilter < 0 && sentiment > 0.5) return false;
    }
    
    return true;
  });
}

/**
 * 更新LLM服务配置
 * @param {Object} config 新的配置
 * @returns {Promise<boolean>} 更新是否成功
 */
async function updateLLMConfig(config) {
  try {
    const llmService = getLLMService();
    return await llmService.updateConfig(config);
  } catch (error) {
    console.error('更新LLM配置失败:', error);
    return false;
  }
}

/**
 * 获取当前LLM服务配置
 * @returns {Object} 当前配置
 */
function getLLMConfig() {
  const llmService = getLLMService();
  return llmService.getConfig();
}

/**
 * 获取支持的LLM提供商列表
 * @returns {Array<string>} 提供商列表
 */
function getSupportedProviders() {
  const llmService = getLLMService();
  return llmService.getSupportedProviders();
}

/**
 * 检查LLM服务是否已初始化
 * @returns {boolean} 是否已初始化
 */
function isServiceInitialized() {
  const llmService = getLLMService();
  return llmService.isServiceReady();
}

// 导出模块API
export {
  initializeScoring,
  scoreDanmu,
  processDanmuList,
  filterByScores,
  updateLLMConfig,
  getLLMConfig,
  getSupportedProviders,
  isServiceInitialized
};
