/**
 * 弹幕筛选逻辑
 * 负责对弹幕进行初步筛选，过滤垃圾信息
 */

// 敏感词过滤配置
const sensitiveWords = [
    // 添加需要过滤的敏感词
  ];
  
  // 垃圾弹幕特征
  const spamPatterns = [
    /^[.。]+$/,  // 纯标点符号
    /^[666]+$/,  // 纯数字666刷屏
    /^[哈哈]+$/  // 纯哈哈刷屏
  ];
  
  /**
   * 基础弹幕过滤器
   * @param {Object} danmu 弹幕对象
   * @returns {boolean} 是否通过过滤（true为保留）
   */
  function basicFilter(danmu) {
    if (!danmu || !danmu.content) {
      return false;
    }
    
    const content = danmu.content.trim();
    
    // 空内容过滤
    if (content.length === 0) {
      return false;
    }
    
    // 长度过滤（过长可能是刷屏）
    if (content.length > 100) {
      return false;
    }
    
    // 敏感词过滤
    for (const word of sensitiveWords) {
      if (content.includes(word)) {
        return false;
      }
    }
    
    // 垃圾弹幕特征过滤
    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 根据平台定制筛选规则
   * @param {Object} danmu 弹幕对象
   * @param {string} platform 平台名称
   * @returns {boolean} 是否通过过滤（true为保留）
   */
  function platformFilter(danmu, platform) {
    // 先进行基础过滤
    if (!basicFilter(danmu)) {
      return false;
    }
    
    // 根据不同平台应用不同规则
    switch (platform) {
      case 'bilibili':
        // B站特定规则
        return bilibiliFilter(danmu);
      case 'youtube':
        // YouTube特定规则
        return youtubeFilter(danmu);
      case 'netflix':
        // Netflix特定规则（更严格，因为主要是字幕）
        return netflixFilter(danmu);
      default:
        return true;
    }
  }
  
  
  /**
   * Netflix特定过滤规则
   * @param {Object} danmu 弹幕对象
   * @returns {boolean} 是否通过过滤
   */
  function netflixFilter(danmu) {
    // 字幕模式下更严格的过滤
    if (danmu.isSubtitle) {
      return true; // 字幕通常都保留
    }
    return true;
  }
  
  export { basicFilter, platformFilter };
