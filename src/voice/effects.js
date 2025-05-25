/**
 * 音效处理模块
 * 为语音添加音效和可视化效果
 */

import { logger } from '../utils/logger.js';

class AudioEffects {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.analyser = null;
    this.initialized = false;
    this.visualizers = [];
  }

  /**
   * 初始化音效处理器
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      // 检查Web Audio API支持
      if (typeof window === 'undefined' || 
          (!window.AudioContext && !window.webkitAudioContext)) {
        logger.error('当前环境不支持Web Audio API');
        return false;
      }
      
      // 创建音频上下文
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      // 创建增益节点（音量控制）
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;  // 默认音量
      
      // 创建分析器节点（用于可视化）
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // 连接节点
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      this.initialized = true;
      logger.info('音效处理器初始化成功');
      return true;
    } catch (error) {
      logger.error('初始化音效处理器失败:', error);
      return false;
    }
  }

  /**
   * 应用音效到音频元素
   * @param {HTMLAudioElement} audioElement 音频元素
   * @returns {boolean} 是否成功应用
   */
  connectAudioElement(audioElement) {
    if (!this.initialized || !audioElement) {
      return false;
    }
    
    try {
      // 创建媒体源节点
      const source = this.audioContext.createMediaElementSource(audioElement);
      
      // 连接到处理链
      source.connect(this.gainNode);
      
      return true;
    } catch (error) {
      logger.error('连接音频元素失败:', error);
      return false;
    }
  }

  /**
   * 处理语音合成的音频
   * @param {SpeechSynthesisUtterance} utterance 语音合成对象
   */
  processSpeechSynthesis(utterance) {
    // 注意：标准Web Speech API不直接支持音频处理
    // 这是一个占位方法，实际应用中需要通过其他方式捕获语音合成的音频
    logger.warn('Web Speech API不直接支持音频处理，需要额外实现');
  }

  /**
   * 设置音量
   * @param {number} volume 音量值 (0-1)
   */
  setVolume(volume) {
    if (!this.initialized) return;
    
    if (volume >= 0 && volume <= 1) {
      this.gainNode.gain.value = volume;
    }
  }

  /**
   * 添加混响效果
   * @param {number} decay 混响衰减时间 (0-5秒)
   */
  addReverb(decay = 2.0) {
    if (!this.initialized) return;
    
    try {
      // 创建卷积节点（混响）
      const convolver = this.audioContext.createConvolver();
      
      // 生成混响脉冲响应
      const rate = this.audioContext.sampleRate;
      const length = rate * decay;
      const impulse = this.audioContext.createBuffer(2, length, rate);
      
      // 填充左右声道
      for (let channel = 0; channel < 2; channel++) {
        const impulseData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          impulseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
      }
      
      // 设置卷积缓冲区
      convolver.buffer = impulse;
      
      // 将卷积器插入处理链
      this.gainNode.disconnect();
      this.gainNode.connect(convolver);
      convolver.connect(this.analyser);
      
      logger.info(`已添加混响效果，衰减时间: ${decay}秒`);
    } catch (error) {
      logger.error('添加混响效果失败:', error);
    }
  }

  /**
   * 添加可视化器
   * @param {Function} visualizerCallback 可视化回调函数
   * @returns {number} 可视化器ID
   */
  addVisualizer(visualizerCallback) {
    if (!this.initialized || typeof visualizerCallback !== 'function') {
      return -1;
    }
    
    const id = this.visualizers.length;
    this.visualizers.push({
      id,
      callback: visualizerCallback,
      active: true
    });
    
    // 如果这是第一个可视化器，开始更新循环
    if (this.visualizers.length === 1) {
      this.startVisualizerUpdate();
    }
    
    return id;
  }

  /**
   * 移除可视化器
   * @param {number} id 可视化器ID
   */
  removeVisualizer(id) {
    const index = this.visualizers.findIndex(v => v.id === id);
    if (index !== -1) {
      this.visualizers.splice(index, 1);
    }
  }

  /**
   * 开始可视化器更新循环
   * @private
   */
  startVisualizerUpdate() {
    if (!this.initialized || this.visualizers.length === 0) {
      return;
    }
    
    // 创建频率数据数组
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateVisualizers = () => {
      // 获取频率数据
      this.analyser.getByteFrequencyData(dataArray);
      
      // 通知所有可视化器
      this.visualizers.forEach(visualizer => {
        if (visualizer.active) {
          visualizer.callback(dataArray, bufferLength);
        }
      });
      
      // 请求下一帧更新
      requestAnimationFrame(updateVisualizers);
    };
    
    // 开始更新循环
    updateVisualizers();
  }

  /**
   * 释放资源
   */
  dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.visualizers = [];
    this.initialized = false;
  }
}

// 创建单例
let audioEffectsInstance = null;

/**
 * 获取音效处理器实例
 * @returns {AudioEffects} 音效处理器实例
 */
function getAudioEffects() {
  if (!audioEffectsInstance) {
    audioEffectsInstance = new AudioEffects();
  }
  return audioEffectsInstance;
}

/**
 * 初始化音效处理器
 * @returns {Promise<boolean>} 初始化是否成功
 */
async function initializeAudioEffects() {
  const effects = getAudioEffects();
  return await effects.initialize();
}
