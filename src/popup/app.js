/**
 * 弹幕助手主要逻辑
 */

// 导入依赖模块
import { scoreDanmu } from '@/ai/scoring.js';
import { initializeVoiceEngine } from '@/voice/engine.js';
import { platformFilter } from '@/core/processor/filter.js';

class DanmuApp {
  constructor() {
    this.socket = null;
    this.messageCount = 0;
    this.voiceEnabled = false;
    this.volume = 50;
    
    // 初始化语音引擎
    this.voiceEngine = initializeVoiceEngine();
    
    this.initializeElements();
    this.initializeSocket();
    this.initializeEventListeners();

    // 添加消息监听器
    window.addEventListener('message', (event) => {
      console.log('收到窗口消息:', event.data);
      if (event.data.type === 'ADD_DANMU') {
        this.handleDanmuMessage(event.data.data);
      }
    });
  }

  initializeElements() {
    this.danmuContainer = document.getElementById('danmuContainer');
    this.toggleVoiceBtn = document.getElementById('toggleVoice');
    this.settingsBtn = document.getElementById('settings');
    this.voiceSelect = document.getElementById('voiceSelect');
    this.volumeControl = document.getElementById('volumeControl');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.messageCountElement = document.getElementById('messageCount');
  }

  initializeSocket() {
    this.socket = io('http://localhost:5175');

    this.socket.on('connect', () => {
      this.updateConnectionStatus('已连接');
    });

    this.socket.on('disconnect', () => {
      this.updateConnectionStatus('未连接');
    });

    this.socket.on('danmu', (message) => {
      this.handleDanmuMessage(message);
    });
  }

  initializeEventListeners() {
    this.toggleVoiceBtn.addEventListener('click', () => {
      this.voiceEnabled = !this.voiceEnabled;
      this.toggleVoiceBtn.textContent = this.voiceEnabled ? '关闭语音' : '开启语音';
    });

    this.volumeControl.addEventListener('input', (e) => {
      this.volume = e.target.value;
    });

    this.settingsBtn.addEventListener('click', () => {
      // 实现设置面板逻辑
    });
  }

  handleDanmuMessage(message) {
    console.log('开始处理弹幕消息:', message);
    
    // 如果消息没有 platform 属性，添加默认值
    if (!message.platform) {
      message.platform = 'default';
    }
    
    // 处理评分和过滤
    scoreDanmu(message.content)
      .then(scores => {
        console.log('弹幕评分结果:', scores);
        const scoredMessage = { ...message, scores };
        
        // 过滤低质量弹幕
        const shouldKeep = platformFilter(scoredMessage, scoredMessage.platform);
        console.log('弹幕过滤结果:', { shouldKeep, message: scoredMessage });
        
        if (!shouldKeep) {
          console.log('弹幕被过滤:', scoredMessage);
          return;
        }
        
        this.messageCount++;
        this.messageCountElement.textContent = `消息数: ${this.messageCount}`;
        
        // 创建并显示弹幕
        const danmuElement = this.createDanmuElement(scoredMessage);
        console.log('创建弹幕元素:', danmuElement);
        this.danmuContainer.appendChild(danmuElement);
        this.danmuContainer.scrollTop = this.danmuContainer.scrollHeight;
        
        // 使用语音合成
        if (this.voiceEnabled && this.voiceEngine) {
          this.speakMessage(scoredMessage);
        }
      })
      .catch(error => {
        console.error('评分处理失败:', error);
      });
  }

  createDanmuElement(message) {
    const element = document.createElement('div');
    element.className = 'danmu-item';
    
    // 设置data-position属性用于测试验证
    element.setAttribute('data-position', message.position || 'scroll');
    
    // 根据位置添加对应样式类，并确保滚动弹幕有动画
    if (message.position === 'top') {
      element.classList.add('top');
    } else if (message.position === 'bottom') {
      element.classList.add('bottom');
    } else {
      // 默认添加滚动动画类
      element.classList.add('scroll');
    }
    
    // 显示内容和评分
    if (message.scores) {
      element.textContent = `${message.content} 
趣味度: ${message.scores.interestingness.toFixed(2)} 
相关性: ${message.scores.relevance.toFixed(2)}`;
    } else {
      element.textContent = message.content;
    }
    
    return element;
  }

  speakMessage(message) {
    // 使用语音引擎播放消息
    if (this.voiceEngine && typeof this.voiceEngine.speak === 'function') {
      try {
        this.voiceEngine.speak(message.content, message.scores);
      } catch (error) {
        console.error('语音合成失败:', error);
      }
    }
  }

  updateConnectionStatus(status) {
    this.connectionStatus.textContent = status;
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.danmuApp = new DanmuApp();
});
