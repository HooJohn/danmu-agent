// src/core/highlightDetector.js

import { logger } from '../utils/logger.js';

class HighlightDetector {
  constructor() {
    this.danmuWindowSeconds = 10; // Time window in seconds to consider for density/intensity
    this.danmuBuffer = [];        // Stores recent danmu messages
    this.densityThreshold = 10;   // Number of danmu in window to be considered dense
    this.intensityThreshold = 0.7;// Average "intensity" score threshold
    this.logger = logger;
    this.logger.info('HighlightDetector initialized.');
  }

  /**
   * Adds an incoming danmu message to the buffer and triggers detection.
   * Danmu object is expected to have:
   * - timestamp (milliseconds, when the danmu was received/created)
   * - scores (object, e.g., { interestingness: 0-1, sentiment: 0-1 })
   * - videoTime (seconds, when the danmu appeared in the video) - useful for associating highlight with video time
   * @param {Object} danmu - The danmu message object.
   */
  addDanmu(danmu) {
    if (!danmu || typeof danmu.timestamp !== 'number' || !danmu.scores) {
      this.logger.warn('HighlightDetector: Invalid danmu object received.', danmu);
      return;
    }

    this.danmuBuffer.push(danmu);
    // this.logger.debug(`HighlightDetector: Danmu added. Buffer size: ${this.danmuBuffer.length}`);

    // Remove old danmu from buffer
    // Consider the timestamp of the newest danmu to define the window's end
    const newestDanmuTimestamp = this.danmuBuffer[this.danmuBuffer.length - 1].timestamp;
    const windowStartTime = newestDanmuTimestamp - (this.danmuWindowSeconds * 1000);

    const oldBufferSize = this.danmuBuffer.length;
    this.danmuBuffer = this.danmuBuffer.filter(d => d.timestamp >= windowStartTime);
    
    if (this.danmuBuffer.length < oldBufferSize) {
      // this.logger.debug(`HighlightDetector: Evicted ${oldBufferSize - this.danmuBuffer.length} old danmu. New buffer size: ${this.danmuBuffer.length}`);
    }

    // Perform detection based on the timestamp of the newly added danmu
    this._detect(newestDanmuTimestamp);
  }

  /**
   * Detects highlights based on danmu density and intensity within the defined window.
   * @param {number} currentTimestamp - The timestamp of the most recent danmu, serving as the end of the detection window.
   * @private
   */
  _detect(currentTimestamp) {
    const windowStartTime = currentTimestamp - (this.danmuWindowSeconds * 1000);
    
    // Filter buffer for danmu within the current window
    const danmuInWindow = this.danmuBuffer.filter(d => d.timestamp >= windowStartTime && d.timestamp <= currentTimestamp);

    if (danmuInWindow.length === 0) {
      return; // No danmu in the current window slice
    }

    // Calculate density
    const density = danmuInWindow.length;
    // this.logger.debug(`HighlightDetector: Window density: ${density} (Timestamp: ${currentTimestamp / 1000 | 0})`);


    // Calculate average intensity (placeholder metric)
    let totalIntensityScore = 0;
    danmuInWindow.forEach(d => {
      // Placeholder: simple average of interestingness and sentiment
      // Ensure scores exist and are numbers
      const interestingness = (d.scores && typeof d.scores.interestingness === 'number') ? d.scores.interestingness : 0;
      const sentiment = (d.scores && typeof d.scores.sentiment === 'number') ? d.scores.sentiment : 0;
      totalIntensityScore += (interestingness + sentiment) / 2;
    });
    const averageIntensity = totalIntensityScore / danmuInWindow.length;
    // this.logger.debug(`HighlightDetector: Window average intensity: ${averageIntensity.toFixed(2)}`);

    // Check thresholds
    // Using '&&' means both conditions must be met. Could be '||' or more complex logic.
    if (density >= this.densityThreshold && averageIntensity >= this.intensityThreshold) {
      // A highlight is detected.
      // For now, just log. Could return an event object or trigger a callback.
      const highlightVideoTime = danmuInWindow[danmuInWindow.length - 1].videoTime; // Time of the latest danmu in the window
      this.logger.info(
        `Highlight DETECTED! Density: ${density}, Avg Intensity: ${averageIntensity.toFixed(2)}. ` +
        `Window End Time (video): ${highlightVideoTime ? highlightVideoTime.toFixed(2) : 'N/A'}s, ` +
        `Window End Timestamp: ${Math.floor(currentTimestamp / 1000)}`
      );
      
      // Example of what a highlight event object could look like:
      // return {
      //   type: 'highlight',
      //   startTime: danmuInWindow[0].videoTime,
      //   endTime: highlightVideoTime,
      //   density: density,
      //   averageIntensity: averageIntensity,
      //   contributingDanmu: danmuInWindow.map(d => d.id || d.content) // or full objects
      // };
    }
  }
}

export { HighlightDetector };
