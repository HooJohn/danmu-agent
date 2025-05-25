/**
 * 消息队列管理模块
 * 负责处理弹幕消息的缓存、队列和分发
 */

class MessageQueue {
    constructor() {
      this.queue = [];
      this.maxSize = 200; // 队列最大长度
      this.listeners = [];
    }
  
    /**
     * 添加弹幕消息到队列
     * @param {Object} message 弹幕消息对象
     */
    addMessage(message) {
      this.queue.push(message);
      
      // 超出最大长度时移除最早的消息
      if (this.queue.length > this.maxSize) {
        this.queue.shift();
      }
      
      // 通知所有监听器
      this.notifyListeners(message);
    }
  
    /**
     * 获取当前队列中的所有消息
     * @returns {Array} 弹幕消息数组
     */
    getAllMessages() {
      return [...this.queue];
    }
  
    /**
     * 清空消息队列
     */
    clearQueue() {
      this.queue = [];
    }
  
    /**
     * 添加消息监听器
     * @param {Function} listener 消息监听函数
     */
    addListener(listener) {
      if (typeof listener === 'function') {
        this.listeners.push(listener);
      }
    }
  
    /**
     * 移除消息监听器
     * @param {Function} listener 要移除的监听函数
     */
    removeListener(listener) {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
  
    /**
     * 通知所有监听器有新消息
     * @param {Object} message 新的弹幕消息
     */
    notifyListeners(message) {
      this.listeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error('监听器处理消息时出错:', error);
        }
      });
    }
  }
  
  const messageQueue = new MessageQueue();
  
  /**
   * 设置消息队列并返回实例
   * @returns {MessageQueue} 消息队列实例
   */
  function setupMessageQueue() {
    return messageQueue;
  }
  
export { setupMessageQueue, messageQueue };
