# Danmu Agent 多平台弹幕助手

---

## **项目简介**

**Danmu Agent** 是一个跨平台的弹幕处理与交互增强工具，支持各大主流视频网站（YouTube、B站、腾讯视频、Netflix、Vimeo等），通过 AI 技术实现实时弹幕抓取、智能筛选与语音播报，提升用户视频观看体验。

项目采用模块化架构设计，结合 WebAssembly 和 ONNX 模型推理技术，实现轻量级本地计算，确保性能优异（内存占用≤150MB，延迟≤800ms）并兼顾隐私安全。

---

## **核心功能**

### **1. 多平台弹幕抓取引擎**
- **通用DOM解析器**：
  - 各平台独立DOM解析脚本（YouTube、B站、腾讯视频等）
  - 支持时间轴对齐（±1.5秒精度），兼容进度条拖拽场景
  - 自动检测与切换平台适配器
- **备用抓取方案**：
  - 对无公开API平台（如Netflix）使用OCR技术
  - 支持用户授权的API接入方式

### **2. AI 动态筛选系统**
- **本地模型推理**：
  - 基于 Qwen2.5-Omni 模型（ONNX格式）在浏览器端本地运行
  - 语义分类：情感倾向、趣味度、互动价值评分
  - 用户行为学习：自适应优化筛选策略
- **平台专属模式**：
  - **B站模式**：活泼语音风格，"高能预警"功能
  - **电影模式**：过滤低俗弹幕，适用Netflix等平台
  - **教育模式**：保留问答和知识点相关弹幕

### **3. 跨语言语音播报系统**
- **多语言支持**：
  - 集成Azure TTS或Web Speech API
  - 自动检测并支持中英德法等语言
- **多场景语音合成**：
  - 直播/电影/学习等多种语音风格
- **高级音效**：
  - Tone.js提供的音效增强
  - 硬件联动可视化（LED灯带同步）

### **4. 统一用户界面**
- **自适应平台标识**：
  - 显示当前平台图标和名称
  - 支持手动切换平台模式
- **功能控制面板**：
  - 模式切换（陪伴/静默/专注）
  - 筛选强度调节滑块
  - 数据面板（弹幕统计、热门关键词）
- **响应式设计**：
  - 桌面端支持快捷键操作
  - 移动端支持手势控制

---

## **技术实现方案**

### **1. 平台检测与适配机制**
```javascript
// 平台检测逻辑
const detectPlatform = () => {
  const hostname = window.location.hostname;
  if (hostname.includes("youtube.com")) return "youtube";
  if (hostname.includes("bilibili.com")) return "bilibili";
  if (hostname.includes("netflix.com")) return "netflix";
  // 其他平台检测...
  return "unknown";
};

```

### **2. 弹幕抓取实现**
```javascript
// YouTube 弹幕解析
const youtubeDanmu = () => {
  const danmuNodes = document.querySelectorAll(".danmu-text");
  return Array.from(danmuNodes).map(node => ({
    text: node.textContent,
    time: node.currentTime,
    userId: node.dataset.userId || "anonymous",
    timestamp: Date.now()
  }));
};

// B站弹幕解析
const bilibiliDanmu = () => {
  const danmuNodes = document.querySelectorAll(".bilibili-danmu");
  return Array.from(danmuNodes).map(node => ({
    text: node.dataset.text,
    time: node.dataset.time,
    userId: node.dataset.userId || "anonymous",
    timestamp: Date.now()
  }));
};

// Netflix OCR备用方案
const netflixOCRDanmu = async () => {
  // 使用Canvas捕获字幕区域
  const canvas = document.createElement("canvas");
  const video = document.querySelector("video");
  const ctx = canvas.getContext("2d");
  
  // 视频字幕区域坐标计算
  const subtitleArea = {
    x: 0,
    y: video.clientHeight * 0.8,
    width: video.clientWidth,
    height: video.clientHeight * 0.2
  };
  
  // 绘制字幕区域并进行OCR识别
  // 返回识别结果...
};
```

### **3. 视频同步与弹幕时间轴**
```javascript
// 视频播放同步
const initVideoSync = (videoSelector, danmuProcessor) => {
  const video = document.querySelector(videoSelector);
  if (!video) return;
  
  // 监听播放进度
  video.addEventListener("timeupdate", () => {
    const currentTime = video.currentTime;
    danmuProcessor.processAtTime(currentTime);
  });
  
  // 监听拖拽事件
  video.addEventListener("seeked", () => {
    danmuProcessor.handleSeek(video.currentTime);
  });
};

// 弹幕处理器
class DanmuProcessor {
  constructor() {
    this.danmuCache = []; // 缓存的弹幕数据
    this.lastProcessedTime = 0;
    this.processingWindow = 1.5; // 秒，处理窗口
  }
  
  addDanmu(danmu) {
    this.danmuCache.push(danmu);
    // 仅保留最近5分钟的弹幕缓存
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.danmuCache = this.danmuCache.filter(d => d.timestamp >= fiveMinutesAgo);
  }
  
  processAtTime(currentTime) {
    // 找出时间轴上当前需要处理的弹幕
    const relevantDanmu = this.danmuCache.filter(d => 
      d.time >= this.lastProcessedTime && 
      d.time <= currentTime + this.processingWindow
    );
    
    // 处理找到的弹幕
    this.processDanmu(relevantDanmu);
    this.lastProcessedTime = currentTime;
  }
  
  handleSeek(newTime) {
    // 拖拽后调整时间轴
    this.lastProcessedTime = newTime - this.processingWindow;
  }
  
  async processDanmu(danmuList) {
    // Web Worker中处理弹幕分析任务
    if (danmuList.length === 0) return;
    
    if (this.worker) {
      this.worker.postMessage({
        type: "process_danmu",
        danmu: danmuList
      });
    } else {
      // 本地处理逻辑...
    }
  }
}
```

### **4. AI模型加载与推理**
```javascript

// 弹幕评分推理
const scoreDanmu = async (session, text) => {
  if (!session) return { score: 0 };
  
  // 标记化文本
  const tokenizer = new Tokenizer();
  const tokens = tokenizer.encode(text);
  
  // 创建模型输入
  const inputTensor = new ort.Tensor("int64", new BigInt64Array(tokens), [1, tokens.length]);
  
  // 运行推理
  const results = await session.run({
    input_ids: inputTensor
  });
  
  // 处理结果
  const scores = results.scores.data;
  return {
    sentiment: scores[0], // 情感分数
    interestingness: scores[1], // 趣味度
    relevance: scores[2] // 相关性
  };
};
```

### **5. 语音合成实现**
```javascript
// TTS引擎初始化
const initTTS = (voiceType = "default") => {
  // 检查浏览器TTS支持
  if (!("speechSynthesis" in window)) {
    return { supported: false };
  }
  
  // 获取可用语音
  const voices = speechSynthesis.getVoices();
  let selectedVoice;
  
  // 根据模式选择合适的语音
  switch (voiceType) {
    case "bilibili":
      // 选择活泼的声音
      selectedVoice = voices.find(v => v.name.includes("Female") && v.lang === "zh-CN");
      break;
    case "movie":
      // 选择低沉的声音
      selectedVoice = voices.find(v => v.name.includes("Male") && v.lang === "zh-CN");
      break;
    default:
      selectedVoice = voices.find(v => v.lang === "zh-CN") || voices[0];
  }
  
  return {
    supported: true,
    voice: selectedVoice
  };
};

// 文本朗读
const speakText = (text, options = {}) => {
  if (!("speechSynthesis" in window)) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // 设置语音参数
  if (options.voice) utterance.voice = options.voice;
  if (options.rate) utterance.rate = options.rate; // 语速
  if (options.pitch) utterance.pitch = options.pitch; // 音调
  if (options.volume) utterance.volume = options.volume; // 音量
  
  // 开始朗读
  speechSynthesis.speak(utterance);
  
  return utterance;
};
```

### **6. Web Worker性能优化**
```javascript
// Web Worker初始化
const initWorker = () => {
  const worker = new Worker(chrome.runtime.getURL("workers/danmu-processor.js"));
  
  worker.onmessage = (event) => {
    const { type, data } = event.data;
    
    switch (type) {
      case "processed_danmu":
        // 处理筛选后的弹幕
        handleProcessedDanmu(data);
        break;
      case "model_loaded":
        console.log("模型加载完成");
        break;
      case "error":
        console.error("Worker错误:", data);
        break;
    }
  };
  
  // 初始化加载模型
  worker.postMessage({
    type: "init",
    modelPath: chrome.runtime.getURL("models/qwen_omni_quantized.onnx")
  });
  
  return worker;
};

// Web Worker实现 (danmu-processor.js)
/*
importScripts("onnxruntime-web.min.js", "tokenizer.js");

let session = null;
let tokenizer = null;

self.onmessage = async (event) => {
  const { type, danmu, modelPath } = event.data;
  
  // 初始化模型
  if (type === "init") {
    try {
      session = await ort.InferenceSession.create(modelPath);
      tokenizer = new Tokenizer();
      self.postMessage({ type: "model_loaded" });
    } catch (error) {
      self.postMessage({ type: "error", data: error.message });
    }
    return;
  }
  
  // 处理弹幕
  if (type === "process_danmu") {
    try {
      const processedDanmu = [];
      
      for (const d of danmu) {
        const score = await scoreDanmu(d.text);
        if (score.interestingness > 0.6) { // 只保留高趣味度弹幕
          processedDanmu.push({
            ...d,
            scores: score
          });
        }
      }
      
      self.postMessage({
        type: "processed_danmu",
        data: processedDanmu
      });
    } catch (error) {
      self.postMessage({ type: "error", data: error.message });
    }
  }
};

// 弹幕评分函数
async function scoreDanmu(text) {
  if (!session || !tokenizer) return { interestingness: 0 };
  
  // 标记化文本
  const tokens = tokenizer.encode(text);
  const inputTensor = new ort.Tensor("int64", new BigInt64Array(tokens), [1, tokens.length]);
  
  // 运行推理
  const results = await session.run({ input_ids: inputTensor });
  const scores = results.scores.data;
  
  return {
    sentiment: scores[0],
    interestingness: scores[1],
    relevance: scores[2]
  };
}
*/
```

---

## **性能优化策略**

### **1. 内存与性能指标**
- **内存占用**: ≤150MB
- **弹幕处理延迟**: ≤800ms
- **单条弹幕处理时间**: ≤50ms

### **2. 优化措施**
- **Web Worker**：将AI模型推理、弹幕筛选等计算密集型任务移至Worker线程
- **弹幕缓存**：
  - 本地缓存高频弹幕文本和处理结果
  - LRU策略管理缓存大小
- **模型优化**：
  - ONNX模型量化（INT8）
  - 使用WebAssembly SIMD加速
  - 模型裁剪，移除不必要的特征检测
- **DOM操作优化**：
  - 使用DocumentFragment批量更新
  - 虚拟滚动列表显示大量弹幕
- **资源按需加载**：
  - 平台适配器动态导入
  - 语音资源延迟加载

### **3. 降级策略**
- **检测性能**：实时监控内存和CPU使用率
- **自动降级**：
  - 弹幕量过大时降低AI筛选频率
  - 极端情况下关闭语音朗读
  - 浏览器不支持WebAssembly时使用轻量级规则引擎替代

---

## **用户体验一致性**

### **1. 视觉设计统一**
- **界面元素**：统一的布局、颜色方案和字体
- **图标系统**：统一的图标设计语言
- **动画效果**：一致的过渡和反馈动画

### **2. 交互逻辑统一**
- **操作流程**：跨平台统一的操作步骤
- **按钮位置**：关键功能按钮位置保持一致
- **快捷方式**：统一的快捷键和手势

### **3. 多设备适配**
- **桌面端**：支持键盘快捷键（如Ctrl+D开关弹幕）
- **移动端**：支持触摸手势（如左右滑动调整弹幕量）

---

## **合规性与隐私保护**

### **1. 数据处理原则**
- **最小收集**：仅处理当前视频的弹幕数据
- **本地处理**：所有AI分析在本地完成，不上传用户数据
- **无浏览历史**：不收集或存储用户浏览历史
- **透明控制**：用户可一键关闭所有分析功能

### **2. 平台政策适配**
- **API使用合规**：严格遵守各平台API使用条款
- **替代方案**：对禁止自动化抓取的平台提供合规的备选方案
- **数据处理声明**：明确告知用户数据处理范围和方式

---

## **测试与验证指标**

### **1. 功能测试指标**
| **平台** | **测试指标** | **目标值** |
|----------|--------------|------------|
| YouTube | 弹幕抓取成功率 | ≥95% |
| B站 | 时间轴同步误差 | ≤1.5秒 |
| Netflix | 字幕OCR准确率 | ≥85% |

### **2. 性能测试指标**
| **指标** | **测试方法** | **目标值** |
|----------|--------------|------------|
| 内存占用 | Chrome任务管理器 | ≤150MB |
| 启动时间 | Performance API | ≤2秒 |
| CPU使用率 | Performance API | 峰值≤30% |
| 弹幕处理延迟 | 自定义计时 | ≤800ms |

### **3. 用户场景测试**
- **B站二次元场景**：验证"萌点"弹幕识别
- **Netflix电影场景**：测试"高能预警"功能
- **YouTube教育场景**：验证多语言翻译功能

---

## **技术栈**
| 模块 | 技术选型 |
|------|----------|
| 弹幕引擎 | JavaScript/TypeScript + DOM解析 |
| 平台适配 | Chrome Extension API + WebRequest |
| AI模型推理 | ONNX.js + WebAssembly |
| OCR识别 | Tesseract.js |
| 语音合成 | Web Speech API / Azure TTS |
| 前端框架 | React（Popup界面） |
| 线程管理 | Web Workers API |
| 构建工具 | Vite + Webpack |
| 测试框架 | Jest + Cypress |

---

## **项目结构**
```
Danmu-Agent/
├── .cursor/                  # Cursor开发规则文件
│   └── rules/                # 各模块规则文件
├── src/                      # 源代码目录
│   ├── core/                 # 核心引擎
│   │   ├── index.js          # 主入口
│   │   ├── messageQueue.js   # 消息队列
│   │   ├── adapters/         # 平台适配器
│   │   │   ├── youtube.js    # YouTube解析器
│   │   │   ├── bilibili.js   # B站解析器
│   │   │   └── netflix.js    # Netflix解析器
│   │   └── processor/        # 弹幕处理
│   │       ├── filter.js     # 弹幕筛选逻辑
│   │       └── sync.js       # 时间轴同步
│   ├── ai/                   # AI模型处理
│   │   ├── model.js          # 模型加载与管理
│   │   ├── tokenizer.js      # 文本标记化
│   │   └── scoring.js        # 弹幕评分逻辑
│   ├── voice/                # 语音合成模块
│   │   ├── engine.js         # 语音引擎
│   │   ├── voices.js         # 声音资源
│   │   └── effects.js        # 音效处理
│   ├── utils/                # 工具函数
│   │   ├── logger.js         # 日志工具
│   │   ├── cache.js          # 缓存管理
│   │   └── platform.js       # 平台检测
│   └── popup/                # 插件界面
│       ├── components/       # UI组件
│       ├── styles/           # 样式文件
│       └── index.js          # 界面入口
├── workers/                  # Web Worker
│   ├── danmu-processor.js    # 弹幕处理Worker
│   └── model-worker.js       # 模型推理Worker
├── models/                   # AI模型文件
│   └── qwen_omni_quantized.onnx # 量化后的模型
├── assets/                   # 静态资源
│   ├── icons/                # 图标资源
│   ├── sounds/               # 音效资源
│   └── styles/               # 全局样式
├── public/                   # 公共资源
│   └── manifest.json         # 扩展清单
├── tests/                    # 测试文件
│   ├── unit/                 # 单元测试
│   └── integration/          # 集成测试
├── README.md                 # 项目文档
└── package.json              # 依赖管理
```

---

## **开发和部署指南**

### **1. 开发环境设置**
```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建生产版本
npm run build
```

### **2. 浏览器扩展安装**
1. 打开Chrome扩展管理页面 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的`dist`目录

### **3. 调试方法**
- 使用Chrome DevTools调试扩展内容
- 查看扩展日志: `chrome://extensions` → 扩展详情 → 查看视图 → 后台页
- 性能分析: Chrome DevTools → Performance面板
