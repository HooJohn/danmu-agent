/**
 * 语音合成引擎
 * 负责将文本转换为语音
 */

// 导入依赖
import { logger } from '../utils/logger.js';

class VoiceEngine {
  constructor() {
    this.initialized = false;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.0;      // 语速 (0.1-10)
    this.pitch = 1.0;     // 音调 (0-2)
    this.volume = 1.0;    // 音量 (0-1)
    this.speaking = false;
    this.queue = [];      // 语音队列
    this.maxQueueSize = 10; // 最大队列长度
    
    // 语音合成实例
    this.synthesis = null;
    
    // 音效处理器
    this.audioContext = null;
    this.gainNode = null;
  }

  /**
   * 初始化语音引擎
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      // 检查浏览器是否支持语音合成API
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        logger.error('当前环境不支持语音合成');
        return false;
      }
      
      this.synthesis = window.speechSynthesis;
      
      // 初始化音频上下文（用于音效处理）
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContextClass();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = this.volume;
      }
      
      // 加载可用的语音
      await this.loadVoices();
      
      this.initialized = true;
      logger.info('语音引擎初始化成功');
      return true;
    } catch (error) {
      logger.error('初始化语音引擎失败:', error);
      return false;
    }
  }

  /**
   * 加载可用的语音
   * @returns {Promise<boolean>} 加载是否成功
   */
  async loadVoices() {
    return new Promise((resolve) => {
      // 检查语音是否已加载
      const checkVoices = () => {
        const voices = this.synthesis.getVoices();
        if (voices.length > 0) {
          this.voices = voices;
          logger.info(`加载了 ${voices.length} 个语音`);
          
          // 默认选择中文语音，如果有的话
          const chineseVoice = voices.find(voice => 
            voice.lang === 'zh-CN' || voice.lang === 'zh-TW' || voice.lang === 'zh-HK'
          );
          
          if (chineseVoice) {
            this.selectedVoice = chineseVoice;
            logger.info(`默认选择中文语音: ${chineseVoice.name}`);
          } else {
            this.selectedVoice = voices[0];
            logger.info(`未找到中文语音，默认选择: ${voices[0].name}`);
          }
          
          resolve(true);
        } else {
          // 语音列表为空，稍后再试
          setTimeout(checkVoices, 100);
        }
      };
      
      // 某些浏览器可能需要onvoiceschanged事件
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = checkVoices;
      }
      
      // 立即尝试获取语音
      checkVoices();
    });
  }

  /**
   * 获取所有可用语音
   * @returns {Array} 语音列表
   */
  getVoices() {
    return this.voices;
  }

  /**
   * 设置语音
   * @param {string|Object} voice 语音名称或语音对象
   * @returns {boolean} 设置是否成功
   */
  setVoice(voice) {
    if (!this.initialized) {
      logger.error('语音引擎未初始化');
      return false;
    }
    
    if (typeof voice === 'string') {
      // 按名称查找语音
      const foundVoice = this.voices.find(v => v.name === voice);
      if (foundVoice) {
        this.selectedVoice = foundVoice;
        logger.info(`已选择语音: ${foundVoice.name}`);
        return true;
      } else {
        logger.warn(`未找到名为 ${voice} 的语音`);
        return false;
      }
    } else if (typeof voice === 'object') {
      // 直接设置语音对象
      this.selectedVoice = voice;
      logger.info(`已选择语音: ${voice.name}`);
      return true;
    }
    
    return false;
  }

  /**
   * 设置语音参数
   * @param {Object} params 语音参数
   */
  setParams(params = {}) {
    if (params.rate !== undefined && params.rate >= 0.1 && params.rate <= 10) {
      this.rate = params.rate;
    }
    
    if (params.pitch !== undefined && params.pitch >= 0 && params.pitch <= 2) {
      this.pitch = params.pitch;
    }
    
    if (params.volume !== undefined && params.volume >= 0 && params.volume <= 1) {
      this.volume = params.volume;
      
      // 更新音效处理器的音量
      if (this.gainNode) {
        this.gainNode.gain.value = this.volume;
      }
    }
  }

  /**
   * 播放文本
   * @param {string} text 要播放的文本
   * @param {Object} options 播放选项
   * @returns {Promise<boolean>} 播放是否成功
   */
  async speak(text, options = {}) {
    if (!this.initialized) {
      logger.error('语音引擎未初始化');
      return false;
    }
    
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    // 如果队列已满，删除最早的内容
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }
    
    // 创建播放任务
    const task = {
      text,
      options: {
        ...options,
        voice: options.voice || this.selectedVoice,
        rate: options.rate || this.rate,
        pitch: options.pitch || this.pitch,
        volume: options.volume || this.volume
      }
    };
    
    // 添加到队列
    this.queue.push(task);
    
    // 如果当前没有在播放，开始播放
    if (!this.speaking) {
      this.processQueue();
    }
    
    return true;
  }

  /**
   * 处理语音队列
   * @private
   */
  processQueue() {
    if (this.queue.length === 0) {
      this.speaking = false;
      return;
    }
    
    this.speaking = true;
    const task = this.queue.shift();
    
    const utterance = new SpeechSynthesisUtterance(task.text);
    
    utterance.voice = task.options.voice;
    utterance.rate = task.options.rate;
    utterance.pitch = task.options.pitch;
    utterance.volume = task.options.volume;
    
    // 设置事件回调
    utterance.onend = () => {
      // 播放完成后处理下一条
      this.processQueue();
    };
    
    utterance.onerror = (error) => {
      logger.error('语音播放错误:', error);
      // 发生错误也继续下一条
      this.processQueue();
    };
    
    // 开始播放
    this.synthesis.speak(utterance);
  }

  /**
   * 停止所有语音播放
   */
  stop() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    
    this.queue = [];
    this.speaking = false;
  }

  /**
   * 暂停语音播放
   */
  pause() {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  /**
   * 恢复语音播放
   */
  resume() {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }

  /**
   * 检测语言
   * @param {string} text 要检测的文本
   * @returns {string} 检测到的语言代码
   */
  detectLanguage(text) {
    // 实现语言检测逻辑
    // 这里可以添加简单的语言检测规则
    if (text.match(/[\u4e00-\u9fa5]/)) {
      return 'zh';
    } else if (text.match(/[a-zA-Z]/)) {
      return 'en';
    } else {
      return 'unknown';
    }
  }
}

// 导出构造函数和辅助函数
export { VoiceEngine };

/**
 * 初始化语音引擎
 * @param {Object} config 语音初始化配置
 * @returns {VoiceEngine} 语音引擎实例
 */
export function initializeVoiceEngine(config = {}) {
  const voiceEngine = new VoiceEngine();
  voiceEngine.setParams(config);
  return voiceEngine;
}
