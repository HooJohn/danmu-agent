/**
 * 浏览器日志工具模块
 * 提供统一的日志记录功能
 */

// 创建日志级别映射
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4
};

// 获取当前日志级别（可以从存储中读取，这里设为默认）
const currentLogLevel = 'info'; // 可以根据环境变量调整

/**
 * 日志工具
 */
const logger = {
  level: currentLogLevel,
  
  /**
   * 设置日志级别
   * @param {string} level 日志级别 (error, warn, info, debug, verbose)
   */
  setLevel(level) {
    if (logLevels[level] !== undefined) {
      this.level = level;
      console.log(`日志级别已更新为: ${level}`);
    }
  },
  
  /**
   * 记录日志消息
   * @param {string} level 日志级别
   * @param {string} message 日志消息
   * @param {...any} meta 元数据
   */
  log(level, message, ...meta) {
    if (logLevels[level] > logLevels[this.level]) {
      return; // 如果当前日志级别低于指定级别，则不记录
    }
    
    const timestamp = new Date().toLocaleString('zh-CN');
    const formattedLevel = level.toUpperCase().padEnd(7);
    
    switch(level) {
      case 'error':
        console.error(`[${timestamp}] [ERROR] ${message}`, ...meta);
        break;
      case 'warn':
        console.warn(`[${timestamp}] [WARN] ${message}`, ...meta);
        break;
      case 'debug':
        console.debug(`[${timestamp}] [DEBUG] ${message}`, ...meta);
        break;
      default:
        console.log(`[${timestamp}] [${formattedLevel}] ${message}`, ...meta);
    }
  },
  
  /**
   * 记录错误日志
   * @param {string} message 日志消息
   * @param {...any} meta 元数据
   */
  error(message, ...meta) {
    this.log('error', message, ...meta);
  },
  
  /**
   * 记录警告日志
   * @param {string} message 日志消息
   * @param {...any} meta 元数据
   */
  warn(message, ...meta) {
    this.log('warn', message, ...meta);
  },
  
  /**
   * 记录信息日志
   * @param {string} message 日志消息
   * @param {...any} meta 元数据
   */
  info(message, ...meta) {
    this.log('info', message, ...meta);
  },
  
  /**
   * 记录调试日志
   * @param {string} message 日志消息
   * @param {...any} meta 元数据
   */
  debug(message, ...meta) {
    this.log('debug', message, ...meta);
  },
  
  /**
   * 记录详细日志
   * @param {string} message 日志消息
   * @param {...any} meta 元数据
   */
  verbose(message, ...meta) {
    this.log('verbose', message, ...meta);
  }
};

export { logger };
