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

// Default list of vulgar words. This should ideally be configurable or come from an external source.
const DEFAULT_VULGAR_WORDS = ['badword1', 'badword2', '示例恶言', '粗俗内容'];

/**
 * Filters danmu based on a list of vulgar words.
 * @param {Object} danmu - The danmu object to filter.
 * @param {Array<string>} [activeWordList=[]] - An optional list of vulgar words. Uses DEFAULT_VULGAR_WORDS if empty.
 * @returns {boolean} True if the danmu passes (not vulgar), false otherwise.
 */
function vulgarityFilter(danmu, activeWordList = []) {
  if (!danmu || !danmu.content) {
    return true; // Pass if no content to check
  }
  const content = danmu.content.toLowerCase(); // Case-insensitive matching
  const wordList = activeWordList && activeWordList.length > 0 ? activeWordList : DEFAULT_VULGAR_WORDS;

  for (const word of wordList) {
    if (content.includes(word.toLowerCase())) {
      logger.debug(`[VulgarityFilter] Filtered due to word '${word}':`, danmu.content);
      return false;
    }
  }
  return true;
}

/**
 * Filters danmu for educational content, keeping relevant items in "education" mode.
 * This is a placeholder and needs significant refinement for actual educational use.
 * @param {Object} danmu - The danmu object to filter. Expected to have 'content' and potentially 'scores'.
 * @returns {boolean} True if the danmu is considered relevant for education mode, false otherwise.
 */
function educationContentFilter(danmu) {
  if (!danmu || !danmu.content) {
    return false; // Filter out if no content
  }
  const content = danmu.content.toLowerCase();

  // Keywords that suggest a question or educational topic
  const eduKeywords = ['?', '问题', '答案', '知识点', 'how to', 'what is', 'explain', 'define', 'learn', 'teach'];
  for (const keyword of eduKeywords) {
    if (content.includes(keyword)) {
      logger.debug(`[EducationFilter] Kept due to keyword '${keyword}':`, danmu.content);
      return true;
    }
  }

  // Placeholder logic using scores (if available)
  if (danmu.scores && typeof danmu.scores.relevance === 'number' && typeof danmu.scores.interestingness === 'number') {
    if (danmu.scores.relevance > 0.6 && danmu.scores.interestingness > 0.5) {
      logger.debug('[EducationFilter] Kept due to high relevance/interestingness scores:', danmu.content, danmu.scores);
      return true;
    }
  }
  
  // Default to filtering out in education mode if no specific criteria are met
  logger.debug('[EducationFilter] Filtered as not meeting education mode criteria:', danmu.content);
  return false; 
}

export { basicFilter, platformFilter, vulgarityFilter, educationContentFilter };
