/**
 * 平台检测与适配模块
 * 用于识别当前视频平台并加载对应的弹幕解析适配器
 */

/**
 * 检测当前所在的视频平台
 * @returns {string} 平台标识符（youtube/bilibili/netflix/unknown）
 */
function detectPlatform() {
  const hostname = window.location.hostname;
  
  if (hostname.includes("youtube.com")) {
    return "youtube";
  } else if (hostname.includes("bilibili.com")) {
    return "bilibili";
  } else if (hostname.includes("netflix.com")) {
    return "netflix";
  }
  
  return "unknown";
}

/**
 * 动态加载对应平台的适配器
 * @param {string} platform - 平台标识符
 * @returns {Promise} 加载适配器的Promise
 */
async function loadPlatformAdapter(platform) {
  switch(platform) {
    case "youtube":
      return await import("../core/adapters/youtube.js");
    case "bilibili":
      return await import("../core/adapters/bilibili.js");
    case "netflix":
      return await import("../core/adapters/netflix.js");
    default:
      throw new Error(`不支持的平台: ${platform}`);
  }
}

/**
 * 获取当前平台标识符
 * @returns {string} 平台标识符（youtube/bilibili/netflix/unknown）
 */
async function getPlatform() {
  const platform = detectPlatform();
  if (platform === 'unknown') {
    throw new Error('无法检测到支持的平台');
  }
  return platform;
}

/**
 * 加载当前平台的适配器
 * @returns {Promise} 加载适配器的Promise
 */
async function loadCurrentPlatformAdapter() {
  const platform = detectPlatform();
  if (platform === 'unknown') {
    throw new Error('未在支持的平台上');
  }
  
  try {
    const adapterModule = await loadPlatformAdapter(platform);
    return adapterModule.default;
  } catch (error) {
    console.error(`加载 ${platform} 平台适配器失败:`, error);
    throw error;
  }
}

export { detectPlatform, loadPlatformAdapter, getPlatform, loadCurrentPlatformAdapter };
