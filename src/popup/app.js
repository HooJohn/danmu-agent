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
    this.modeSelect = document.getElementById('modeSelect');
    // this.connectionStatus = document.getElementById('connectionStatus'); // Socket.IO status removed
    this.messageCountElement = document.getElementById('messageCount');

    // Settings Panel Elements
    this.settingsPanel = document.getElementById('settingsPanel');
    this.interestingnessThresholdInput = document.getElementById('interestingnessThreshold');
    this.interestingnessValueDisplay = document.getElementById('interestingnessValue');
    this.relevanceThresholdInput = document.getElementById('relevanceThreshold');
    this.relevanceValueDisplay = document.getElementById('relevanceValue');
    this.sentimentFilterSelect = document.getElementById('sentimentFilter');
    this.highlightDetectionEnabledCheckbox = document.getElementById('highlightDetectionEnabled');
    this.vulgarityKeywordsTextarea = document.getElementById('vulgarityKeywords'); // Added
    this.saveVulgarityKeywordsBtn = document.getElementById('saveVulgarityKeywordsBtn'); // Added
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    
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

    if (this.modeSelect) {
      this.modeSelect.addEventListener('change', (e) => {
        const selectedMode = e.target.value;
        chrome.runtime.sendMessage({ type: 'SET_MODE', data: { mode: selectedMode } });
        console.log('Popup: Mode changed to', selectedMode);
      });
    }

    if (this.settingsBtn && this.settingsPanel) {
      this.settingsBtn.addEventListener('click', () => {
        this.settingsPanel.style.display = this.settingsPanel.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (this.closeSettingsBtn && this.settingsPanel) {
      this.closeSettingsBtn.addEventListener('click', () => {
        this.settingsPanel.style.display = 'none';
      });
    }

    const createThresholdListener = (inputElement, valueDisplayElement, configKey) => {
      if (inputElement && valueDisplayElement) {
        inputElement.addEventListener('input', (e) => {
          const value = parseFloat(e.target.value);
          valueDisplayElement.textContent = value.toFixed(1);
          // Send message on 'change' for less frequent updates
        });
        inputElement.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            chrome.runtime.sendMessage({ 
                type: 'UPDATE_AI_FILTER_CONFIG', 
                data: { [configKey]: value } 
            });
        });
      }
    };
    createThresholdListener(this.interestingnessThresholdInput, this.interestingnessValueDisplay, 'interestingnessThreshold');
    createThresholdListener(this.relevanceThresholdInput, this.relevanceValueDisplay, 'relevanceThreshold');

    if (this.sentimentFilterSelect) {
      this.sentimentFilterSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        chrome.runtime.sendMessage({ 
            type: 'UPDATE_AI_FILTER_CONFIG', 
            data: { sentimentFilter: value === 'null' ? null : parseInt(value) } 
        });
      });
    }

    if (this.highlightDetectionEnabledCheckbox) {
      this.highlightDetectionEnabledCheckbox.addEventListener('change', (e) => {
        chrome.runtime.sendMessage({ 
          type: 'SET_HIGHLIGHT_DETECTION_ENABLED', 
          data: { enabled: e.target.checked } 
        });
        console.log('Popup: Highlight Detection enabled set to', e.target.checked);
      });
    }

    if (this.saveVulgarityKeywordsBtn && this.vulgarityKeywordsTextarea) {
      this.saveVulgarityKeywordsBtn.addEventListener('click', () => {
        const keywordsString = this.vulgarityKeywordsTextarea.value;
        chrome.runtime.sendMessage({ 
          type: 'UPDATE_VULGARITY_KEYWORDS', 
          data: { keywords: keywordsString.split(',').map(k => k.trim()).filter(k => k) } 
        });
        console.log('Popup: Vulgarity keywords sent to background.');
        // Optionally, add a visual confirmation like "Saved!" temporarily
      });
    }
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
    if (settings.currentMode && this.modeSelect) {
      this.modeSelect.value = settings.currentMode;
    }

    // Apply AI Filter Config settings
    if (settings.aiFilterConfig) {
      if (this.interestingnessThresholdInput && this.interestingnessValueDisplay) {
        this.interestingnessThresholdInput.value = settings.aiFilterConfig.interestingnessThreshold;
        this.interestingnessValueDisplay.textContent = parseFloat(settings.aiFilterConfig.interestingnessThreshold).toFixed(1);
      }
      if (this.relevanceThresholdInput && this.relevanceValueDisplay) {
        this.relevanceThresholdInput.value = settings.aiFilterConfig.relevanceThreshold;
        this.relevanceValueDisplay.textContent = parseFloat(settings.aiFilterConfig.relevanceThreshold).toFixed(1);
      }
      if (this.sentimentFilterSelect) {
        this.sentimentFilterSelect.value = String(settings.aiFilterConfig.sentimentFilter); // Ensure 'null' is string for value
      }
    }
    if (settings.highlightDetectionEnabled !== undefined && this.highlightDetectionEnabledCheckbox) {
      this.highlightDetectionEnabledCheckbox.checked = settings.highlightDetectionEnabled;
    }
    if (settings.vulgarityKeywords && Array.isArray(settings.vulgarityKeywords) && this.vulgarityKeywordsTextarea) {
      this.vulgarityKeywordsTextarea.value = settings.vulgarityKeywords.join(', ');
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
