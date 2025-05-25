// src/core/filter.js

import { logger } from '../utils/logger.js';

/**
 * Basic filter for danmu messages.
 * Filters based on content presence and length.
 * @param {Object} danmu - The danmu object to filter.
 *                         Expected to have a 'content' property.
 * @returns {boolean} True if the danmu passes the filter, false otherwise.
 */
function basicFilter(danmu) {
  if (!danmu || danmu.content === null || danmu.content === undefined || danmu.content.trim() === '') {
    logger.debug('[BasicFilter] Filtered due to empty content:', danmu);
    return false;
  }

  if (danmu.content.length > 100) {
    logger.debug(`[BasicFilter] Filtered due to excessive length (${danmu.content.length}):`, danmu.content);
    return false;
  }

  return true;
}

/**
 * Platform-specific filter for danmu messages.
 * Filters based on platform-specific keywords or rules.
 * @param {Object} danmu - The danmu object to filter.
 * @param {string} platform - The platform identifier (e.g., 'youtube', 'bilibili').
 * @returns {boolean} True if the danmu passes the filter, false otherwise.
 */
function platformFilter(danmu, platform) {
  if (!danmu || !danmu.content) { // Basic check, though basicFilter should catch most
    return false;
  }

  switch (platform) {
    case 'youtube':
      // No specific YouTube filters for now
      return true;
    case 'bilibili':
      if (danmu.content.includes('舰长')) {
        logger.debug(`[PlatformFilter][Bilibili] Filtered keyword '舰长':`, danmu.content);
        return false;
      }
      // Add more Bilibili specific filters here if needed
      return true;
    // Add cases for other platforms as needed
    // case 'twitch':
    //   // example: if (danmu.content.startsWith("!")) return false;
    //   return true;
    default:
      // For unknown or unhandled platforms, default to passing the filter
      return true;
  }
}

export { basicFilter, platformFilter };
