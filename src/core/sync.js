// src/core/sync.js

import { logger } from '../utils/logger.js';

/**
 * TimeSynchronizer class manages danmu display timing relative to video playback.
 * It caches danmu and provides methods to process them based on the current video time.
 */
class TimeSynchronizer {
  constructor() {
    this.danmuCache = [];
    this.lastProcessedTime = 0; // Tracks the video time up to which danmus have been processed
    this.processingWindow = 1.5; // Seconds. Danmus within this window ahead of current time may be processed.
    this.logger = logger; // Use the imported logger
    this.logger.info('TimeSynchronizer initialized.');
  }

  /**
   * Adds a new danmu object to the cache.
   * Danmu objects should have at least 'videoTime' and 'timestamp'.
   * Implements cache eviction for old danmu.
   * @param {Object} danmu - The danmu object to add.
   *                         Example: { content: "Hello", videoTime: 10.5, timestamp: 1678886400000, ... }
   */
  addDanmu(danmu) {
    if (!danmu || typeof danmu.videoTime !== 'number' || typeof danmu.timestamp !== 'number') {
      this.logger.warn('TimeSynchronizer: Attempted to add invalid danmu object.', danmu);
      return;
    }

    this.danmuCache.push(danmu);
    this.logger.debug(`TimeSynchronizer: Added danmu to cache. Cache size: ${this.danmuCache.length}`);

    // Cache eviction: keep only danmu from the last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const oldCacheSize = this.danmuCache.length;
    this.danmuCache = this.danmuCache.filter(d => d.timestamp >= fiveMinutesAgo);
    
    if (this.danmuCache.length < oldCacheSize) {
      this.logger.debug(`TimeSynchronizer: Evicted ${oldCacheSize - this.danmuCache.length} old danmu. New cache size: ${this.danmuCache.length}`);
    }
  }

  /**
   * Processes danmu from the cache that are relevant for the current video time.
   * A danmu 'd' is relevant if d.videoTime >= this.lastProcessedTime 
   * AND d.videoTime <= currentTime + this.processingWindow.
   * @param {number} currentTime - The current video playback time in seconds.
   * @param {Function} displayCallback - Callback function to handle the display of relevant danmu.
   *                                     It will be called with an array of danmu objects.
   */
  processAtTime(currentTime, displayCallback) {
    if (typeof currentTime !== 'number') {
      this.logger.warn('TimeSynchronizer: processAtTime called with invalid currentTime.', currentTime);
      return;
    }

    const relevantDanmu = this.danmuCache.filter(d => 
      d.videoTime >= this.lastProcessedTime && 
      d.videoTime <= currentTime + this.processingWindow
    );

    if (relevantDanmu.length > 0) {
      this.logger.debug(`TimeSynchronizer: Found ${relevantDanmu.length} relevant danmu for time ${currentTime.toFixed(2)} (last processed: ${this.lastProcessedTime.toFixed(2)}).`);
      if (typeof displayCallback === 'function') {
        displayCallback(relevantDanmu);
      } else {
        this.logger.warn('TimeSynchronizer: displayCallback is not a function.');
      }
    }
    
    // Update lastProcessedTime to the current video time, regardless of whether danmu were found.
    // This prevents reprocessing of the same time slot unless a seek occurs.
    this.lastProcessedTime = currentTime;
  }

  /**
   * Handles a video seek operation.
   * Adjusts lastProcessedTime to allow reprocessing of danmu around the new seek time.
   * @param {number} newTime - The new video time after seeking, in seconds.
   */
  handleSeek(newTime) {
    if (typeof newTime !== 'number') {
      this.logger.warn('TimeSynchronizer: handleSeek called with invalid newTime.', newTime);
      return;
    }
    this.logger.info(`TimeSynchronizer: Handling seek to ${newTime.toFixed(2)}. Previous lastProcessedTime: ${this.lastProcessedTime.toFixed(2)}`);
    // Adjust lastProcessedTime to slightly before the new time to allow reprocessing
    // danmu that might have been skipped, considering the processing window.
    this.lastProcessedTime = Math.max(0, newTime - this.processingWindow);
    this.logger.info(`TimeSynchronizer: New lastProcessedTime after seek: ${this.lastProcessedTime.toFixed(2)}`);
  }
}

export { TimeSynchronizer };
