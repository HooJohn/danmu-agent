/**
 * 时间轴同步模块
 * 负责处理弹幕与视频时间的同步，确保弹幕按正确时间显示
 * 
 * 注意：不再直接处理视频时间偏移，这部分交由适配器处理
 */

export class TimeSynchronizer {
    /**
     * 构造函数
     * @param {number} cacheDuration - 缓存持续时间（分钟），默认5分钟
     */
    constructor(cacheDuration = 5) {
      this.processingWindow = 1.5; // 处理窗口（秒）
      this.lastProcessedTime = 0; // 上次处理的时间点
      this.danmuCache = []; // 弹幕缓存
      this.cacheDuration = cacheDuration * 60 * 1000; // 缓存持续时间（毫秒）
      this.maxCacheSize = 500; // 最大缓存数量

      // LRU 缓存清理定时器
      this.cacheCleanupInterval = null;
      this.cleanupIntervalTime = 30000; // 默认每30秒清理一次缓存

      // 启动 LRU 缓存清理定时器
      this.startCacheCleanup();
    }

    /**
     * 启动 LRU 缓存清理定时器
     */
    startCacheCleanup() {
      if (this.cacheCleanupInterval) {
        this.stopCacheCleanup(); // 如果已存在，先停止
      }

      this.cacheCleanupInterval = setInterval(() => {
        this.cleanupCache();
      }, this.cleanupIntervalTime);

      console.log("TimeSynchronizer 缓存清理定时器已启动");
    }

    /**
     * 停止 LRU 缓存清理
     */
    stopCacheCleanup() {
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
        this.cacheCleanupInterval = null;
      }
    }

    /**
     * 添加弹幕到缓存
     * @param {Object} danmu 弹幕对象
     */
    addDanmu(danmu) {
      this.danmuCache.push(danmu);
      
      // 缓存超出最大数量时，移除最早的弹幕
      if (this.danmuCache.length > this.maxCacheSize) {
        this.danmuCache.shift();
      }
    }

    /**
     * 添加多条弹幕到缓存
     * @param {Array} danmuList 弹幕对象数组
     */
    addDanmuList(danmuList) {
      for (const danmu of danmuList) {
        this.addDanmu(danmu);
      }
    }

    /**
     * 获取指定时间点附近的弹幕
     * @param {number} currentTime 当前视频时间
     * @returns {Array} 符合时间条件的弹幕数组
     */
    getDanmuAtTime(currentTime) {
      // 找出时间轴上当前需要处理的弹幕（不再调整时间偏移）
      return this.danmuCache.filter(danmu => {
        // 检查此弹幕是否在处理窗口内
        return danmu.videoTime >= this.lastProcessedTime && 
               danmu.videoTime <= currentTime + this.processingWindow;
      });
    }

    /**
     * 在指定视频时间处理弹幕
     * @param {number} currentTime 当前视频时间
     * @param {Function} callback 处理弹幕的回调函数
     */
    processAtTime(currentTime, callback) {
      const relevantDanmu = this.getDanmuAtTime(currentTime);
      
      if (relevantDanmu.length > 0 && typeof callback === 'function') {
        callback(relevantDanmu);
      }
      
      this.lastProcessedTime = currentTime;
    }

    /**
     * 处理视频拖拽事件
     * @param {number} newTime 新的视频时间
     */
    handleSeek(newTime) {
      // 拖拽后调整时间轴
      this.lastProcessedTime = newTime - this.processingWindow;
      // 清空过期的弹幕缓存
      this.cleanupCache(newTime);
    }

    /**
     * 清理过期的弹幕缓存
     * @param {number} currentTime 当前视频时间
     */
    cleanupCache(currentTime) {
      // 保留当前时间前10秒和后60秒的弹幕
      const minTime = currentTime - 10;
      const maxTime = currentTime + 60;
      
      this.danmuCache = this.danmuCache.filter(danmu => 
        danmu.videoTime >= minTime && danmu.videoTime <= maxTime
      );
    }

    /**
     * 设置处理窗口大小
     * @param {number} seconds 处理窗口大小（秒）
     */
    setProcessingWindow(seconds) {
      if (seconds > 0 && seconds <= 5) {
        this.processingWindow = seconds;
      }
    }

    /**
     * 清空弹幕缓存
     * @param {number} [cacheAge] 可选的缓存年龄（毫秒），如果提供则清理更旧的缓存
     */
    clearCache(cacheAge) {
      if (cacheAge && cacheAge > 0) {
        const now = Date.now();
        this.danmuCache = this.danmuCache.filter(danmu => danmu.timestamp > now - cacheAge);
      } else {
        this.danmuCache = [];
      }
      this.lastProcessedTime = 0;
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 缓存统计信息
     */
    getCacheStats() {
      const stats = {
        total: this.danmuCache.length,
        maxSize: this.maxCacheSize,
        timeRange: {
          start: 0,
          end: 0
        }
      };

      if (this.danmuCache.length > 0) {
        // 避免使用 Math.min/max，采用跟踪方式
        let minTime = Infinity;
        let maxTime = -Infinity;
        this.danmuCache.forEach(danmu => {
          if (danmu.videoTime < minTime) minTime = danmu.videoTime;
          if (danmu.videoTime > maxTime) maxTime = danmu.videoTime;
        });
        stats.timeRange = {
          start: minTime,
          end: maxTime
        };
      }
      return stats;
    }
}

export default TimeSynchronizer;
