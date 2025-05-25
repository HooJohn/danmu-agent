/**
 * 弹幕助手主要逻辑
 */

// Removed imports for scoreDanmu, initializeVoiceEngine, platformFilter

class DanmuApp {
  constructor() {
    // this.socket = null; // Socket.IO removed
    this.messageCount = 0;
    // this.voiceEnabled = false; // State managed by background.js
    // this.volume = 50; // State managed by background.js
    // this.voiceEngine = null; // Voice engine is in background.js

    this.initializeElements();
    // this.initializeSocket(); // Socket.IO removed
    this.initializeEventListeners();
    this.requestInitialData();

    // Listen for messages from background.js
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Popup: Received message from background:', message);
      if (message.type === 'POPUP_DISPLAY_DANMU') {
        // Assuming message.data is a single danmu object or an array
        if (Array.isArray(message.data)) {
            message.data.forEach(danmu => this.handleDanmuMessage(danmu));
        } else {
            this.handleDanmuMessage(message.data);
        }
      } else if (message.type === 'VOICE_LIST_RESPONSE') {
        this.populateVoiceList(message.data);
      } else if (message.type === 'CURRENT_SETTINGS_RESPONSE') {
        this.applyCurrentSettings(message.data);
      }
      // Acknowledge message processing (optional, good practice)
      // sendResponse({ received: true }); 
      return true; // Keep message channel open for async response if needed by sendResponse
    });
  }

  initializeElements() {
    this.danmuContainer = document.getElementById('danmuContainer');
    this.toggleVoiceBtn = document.getElementById('toggleVoice');
    this.settingsBtn = document.getElementById('settings'); // Keep for future use
    this.voiceSelect = document.getElementById('voiceSelect');
    this.volumeControl = document.getElementById('volumeControl');
    // this.connectionStatus = document.getElementById('connectionStatus'); // Socket.IO status removed
    this.messageCountElement = document.getElementById('messageCount');
    
    // Update status display to generic "弹幕助手" or similar, as Socket.IO is gone
    const connectionStatusEl = document.getElementById('connectionStatus');
    if (connectionStatusEl) {
        connectionStatusEl.textContent = '弹幕助手'; 
    }
  }

  // initializeSocket() { /* Socket.IO removed */ }

  initializeEventListeners() {
    this.toggleVoiceBtn.addEventListener('click', () => {
      console.log('Popup: Toggle Voice button clicked');
      chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE_ENABLED' });
    });

    this.volumeControl.addEventListener('input', (e) => {
      const volumeValue = parseInt(e.target.value, 10) / 100; // Normalize to 0-1
      console.log(`Popup: Volume control changed to ${volumeValue}`);
      chrome.runtime.sendMessage({ type: 'SET_VOLUME', data: { volume: volumeValue } });
    });

    this.voiceSelect.addEventListener('change', (e) => {
      const voiceName = e.target.value;
      console.log(`Popup: Voice select changed to ${voiceName}`);
      chrome.runtime.sendMessage({ type: 'SET_VOICE_NAME', data: { voiceName: voiceName } });
    });

    // this.settingsBtn.addEventListener('click', () => { /* For future settings panel */ });
  }

  requestInitialData() {
    console.log('Popup: Requesting initial data from background script...');
    chrome.runtime.sendMessage({ type: 'GET_VOICE_LIST' });
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_SETTINGS' });
  }
  
  applyCurrentSettings(settings) {
    console.log('Popup: Applying current settings from background:', settings);
    if (settings.voiceEnabled !== undefined) {
        this.toggleVoiceBtn.textContent = settings.voiceEnabled ? '关闭语音' : '开启语音';
    }
    if (settings.volume !== undefined) {
        this.volumeControl.value = settings.volume * 100; // Denormalize for slider
    }
    if (settings.selectedVoiceName) {
        // This needs populateVoiceList to run first.
        // If voices are not populated yet, this might not select correctly.
        // Consider storing selectedVoiceName and applying it after voices are populated.
        this.voiceSelect.value = settings.selectedVoiceName;
    }
  }

  handleDanmuMessage(message) {
    // message is now assumed to be a processed danmu object from background.js
    console.log('Popup: Handling danmu message for display:', message);
    
    this.messageCount++;
    this.messageCountElement.textContent = `消息数: ${this.messageCount}`;
    
    const danmuElement = this.createDanmuElement(message);
    this.danmuContainer.appendChild(danmuElement);
    
    // Auto-scroll to the bottom
    this.danmuContainer.scrollTop = this.danmuContainer.scrollHeight;
  }

  createDanmuElement(message) {
    const element = document.createElement('div');
    element.className = 'danmu-item';
    
    // Setting data-position (if available in message object from background)
    element.setAttribute('data-position', message.position || 'scroll');
    
    if (message.position === 'top') {
      element.classList.add('top');
    } else if (message.position === 'bottom') {
      element.classList.add('bottom');
    } else {
      element.classList.add('scroll');
    }
    
    // Display only content, AI scores are not handled here anymore
    element.textContent = message.content; 
    
    // Example: Apply color if provided in message object
    if (message.color) {
        element.style.color = message.color;
    }
    
    return element;
  }

  // speakMessage(message) { /* Voice synthesis handled by background.js */ }

  // updateConnectionStatus(status) { /* Socket.IO status removed */ }

  populateVoiceList(voices) {
    console.log('Popup: Populating voice list with:', voices);
    if (!this.voiceSelect) return;

    const currentSelectedValue = this.voiceSelect.value; // Preserve selection if possible

    this.voiceSelect.innerHTML = ''; // Clear existing options

    if (!voices || voices.length === 0) {
      const defaultOption = document.createElement('option');
      defaultOption.value = 'default';
      defaultOption.textContent = '无可用语音';
      this.voiceSelect.appendChild(defaultOption);
      return;
    }

    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name; // Assuming voice object has a 'name' property
      option.textContent = `${voice.name} (${voice.lang})`; // Display name and lang
      this.voiceSelect.appendChild(option);
    });
    
    // Try to re-select previously selected voice, or a default
    if (voices.some(v => v.name === currentSelectedValue)) {
        this.voiceSelect.value = currentSelectedValue;
    } else if (voices.length > 0) {
        // Optionally select the first voice as default if previous selection is gone
        // this.voiceSelect.value = voices[0].name; 
        // Or send message to background to set a default from its perspective
    }
  }
}

// Initialize应用
document.addEventListener('DOMContentLoaded', () => {
  window.danmuApp = new DanmuApp();
});
