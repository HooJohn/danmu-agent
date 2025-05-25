/**
 * 语音资源管理模块
 * 处理不同场景下的语音风格设置
 */

// import { getVoiceEngine } from './engine.js'; // Removed as VoiceEngine instance is passed directly
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
  return {
    rate: VOICE_PRESETS.default.rate,
    pitch: VOICE_PRESETS.default.pitch,
    volume: VOICE_PRESETS.default.volume
  };
}

/**
 * 应用平台特定的语音预设
 * @param {Object} voiceEngineInstance - An instance of the VoiceEngine.
 * @param {string} platform - 平台名称 (e.g., 'bilibili', 'youtube').
 * @returns {boolean} 设置是否成功
 */
function applyPlatformPreset(voiceEngineInstance, platform) {
  if (!voiceEngineInstance || !voiceEngineInstance.initialized) {
    logger.error('语音引擎实例未提供或未初始化，无法应用预设');
    return false;
  }
  
  // 获取平台预设
  const preset = VOICE_PRESETS[platform] || VOICE_PRESETS.default;
  
  // 应用预设 (rate, pitch, volume)
  voiceEngineInstance.setParams(preset);
  
  // 为特定平台选择合适的语音 (voice name/object)
  switch (platform) {
    case 'bilibili':
      // 为B站模式尝试选择女声
      const femaleVoice = voiceEngineInstance.voices.find(voice => 
        (voice.lang === 'zh-CN' || voice.lang === 'zh-TW') && 
        (voice.name.includes('Female') || voice.name.includes('女') || voice.name.includes('xiaoxiao')) // Added more keywords
      );
      if (femaleVoice) {
        voiceEngineInstance.setVoice(femaleVoice.name); // Pass voice name
      }
      break;
      
    case 'movie':
      // 为电影模式尝试选择男声
      const maleVoice = voiceEngineInstance.voices.find(voice => 
        (voice.lang === 'zh-CN' || voice.lang === 'zh-TW') && 
        (voice.name.includes('Male') || voice.name.includes('男')) // Added more keywords
      );
      if (maleVoice) {
        voiceEngineInstance.setVoice(maleVoice.name); // Pass voice name
      }
      break;
    // Add other platforms if needed
  }
  
  logger.info(`已应用 ${platform} 平台语音预设及特定语音选择（如果匹配成功）。`);
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
