/**
 * 语音资源管理模块
 * 处理不同场景下的语音风格设置
 */

import { getVoiceEngine } from './engine.js';
import { logger } from '../utils/logger.js';

// 语音场景预设
const VOICE_PRESETS = {
  // B站模式 - 活泼语音风格
  bilibili: {
    rate: 1.2,       // 语速稍快
    pitch: 1.2,      // 音调稍高
    volume: 0.9
  },
  
  // 电影模式 - 沉稳语音风格
  movie: {
    rate: 0.9,       // 语速稍慢
    pitch: 0.9,      // 音调稍低
    volume: 0.8
  },
  
  // 教育模式 - 清晰语音风格
  education: {
    rate: 1.0,       // 正常语速
    pitch: 1.0,      // 正常音调
    volume: 1.0
  },
  
  // 默认模式
  default: {
    rate: 1.0,
    pitch: 1.0,
    volume: 0.9
  }
};

/**
 * 根据弹幕内容选择语音风格
 * @param {Object} danmu 弹幕对象
 * @returns {Object} 语音参数
 */
function selectVoiceStyleByContent(danmu) {
  const content = danmu.content || '';
  
  // 检测强调语气（如感叹号多的内容）
  if (/[!！]{2,}/.test(content)) {
    return {
      rate: 1.2,   // 兴奋的语速
      pitch: 1.3,  // 提高音调
      volume: 1.0  // 提高音量
    };
  }
  
  // 检测疑问语气
  if (/[?？]+$/.test(content)) {
    return {
      rate: 0.9,   // 稍慢语速
      pitch: 1.1,  // 稍高音调
      volume: 0.9
    };
  }
  
  // 检测"哈哈"等笑声
  if (/[哈嘻嘿啊]{3,}/.test(content)) {
    return {
      rate: 1.3,   // 快速语速
      pitch: 1.2,  // 高音调
      volume: 0.9
    };
  }
  
  // 默认风格
  return VOICE_PRESETS.default;
}

/**
 * 应用平台特定的语音预设
 * @param {string} platform 平台名称
 * @returns {boolean} 设置是否成功
 */
function applyPlatformPreset(platform) {
  const engine = getVoiceEngine();
  
  if (!engine || !engine.initialized) {
    logger.error('语音引擎未初始化，无法应用预设');
    return false;
  }
  
  // 获取平台预设
  const preset = VOICE_PRESETS[platform] || VOICE_PRESETS.default;
  
  // 应用预设
  engine.setParams(preset);
  
  // 为特定平台选择合适的语音
  switch (platform) {
    case 'bilibili':
      // 为B站模式尝试选择女声
      const femaleVoice = engine.voices.find(voice => 
        (voice.lang === 'zh-CN' || voice.lang === 'zh-TW') && 
        voice.name.includes('Female')
      );
      if (femaleVoice) {
        engine.setVoice(femaleVoice);
      }
      break;
      
    case 'movie':
      // 为电影模式尝试选择男声
      const maleVoice = engine.voices.find(voice => 
        (voice.lang === 'zh-CN' || voice.lang === 'zh-TW') && 
        voice.name.includes('Male')
      );
      if (maleVoice) {
        engine.setVoice(maleVoice);
      }
      break;
  }
  
  logger.info(`已应用 ${platform} 平台语音预设`);
  return true;
}

/**
 * 获取支持的语音预设列表
 * @returns {Object} 预设列表
 */
function getVoicePresets() {
  return { ...VOICE_PRESETS };
}

export { selectVoiceStyleByContent, applyPlatformPreset, getVoicePresets, VOICE_PRESETS };
