/**
 * Danmu Adapter Interface (Base Class)
 *
 * 定义所有平台弹幕适配器需要遵循的接口规范。
 * 使用 ES Module 导出。
 */
export class DanmuAdapter {
  /**
   * 构造函数
   * @param {string} platformName - 平台名称 (e.g., 'youtube', 'bilibili')
   */
  constructor(platformName) {
    if (this.constructor === DanmuAdapter) {
      throw new Error("不能直接实例化抽象类 DanmuAdapter");
    }
    this.platform = platformName;
    console.log(`初始化 ${this.platform} 适配器基类`);
  }

  /**
   * 初始化适配器（可选）
   * 可以在此进行平台特定的检查或设置。
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    console.warn(`适配器 ${this.platform} 未实现可选的 initialize 方法`);
    return true; // 默认成功
  }

  /**
   * 开始抓取弹幕
   * @param {Function} callback - 当抓取到新弹幕时调用的回调函数。
   *                             回调函数接收一个弹幕对象数组作为参数。
   *                             弹幕对象格式建议：{ id, platform, author, content, color, videoTime?, timestamp }
   *                             videoTime 是可选的，如果能从元素获取则提供。
   */
  startCapture(callback) {
    throw new Error(`适配器 ${this.platform} 未实现 startCapture 方法`);
  }

  /**
   * 停止抓取弹幕
   */
  stopCapture() {
    throw new Error(`适配器 ${this.platform} 未实现 stopCapture 方法`);
  }

  /**
   * (内部方法，可选) 实际执行弹幕抓取的逻辑
   * 通常由 startCapture 内部调用（例如在 MutationObserver 回调中）。
   * @returns {Array} 弹幕对象数组
   */
  // captureDanmu() {
  //   throw new Error(`适配器 ${this.platform} 未实现 captureDanmu 方法 (如果需要)`);
  // }

  /**
   * 获取视频标题（可选）
   * @returns {string} 视频标题
   */
  getVideoTitle() {
    console.warn(`适配器 ${this.platform} 未实现可选的 getVideoTitle 方法`);
    return '未知视频';
  }

  /**
   * 获取视频ID（可选）
   * @returns {string} 视频ID
   */
  getVideoId() {
    console.warn(`适配器 ${this.platform} 未实现可选的 getVideoId 方法`);
    return '';
  }

  // 可以根据需要添加更多通用方法接口
}

// 可以定义一个标准的弹幕对象接口（如果使用 TypeScript 会更好）
// export interface Danmu {
//   id: string | number;
//   platform: string;
//   author?: string;
//   content: string;
//   color?: string;
//   videoTime?: number; // 弹幕在视频中的时间点 (秒)
//   timestamp: number; // 抓取到的系统时间戳 (毫秒)
//   // 其他平台特定字段...
// }
