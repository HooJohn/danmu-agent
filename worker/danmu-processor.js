// Import scripts for ONNX runtime and tokenizer
importScripts("onnxruntime-web.min.js", "tokenizer.js");

/**
 * 弹幕处理Worker
 * 负责在后台线程中处理弹幕分析和筛选
 */

// ONNX session and tokenizer instances
let session;
let tokenizer;
let isModelLoaded = false; // Track model loading status

// Default processing configuration
let currentProcessingConfig = {
  interestingnessThreshold: 0.5,
  relevanceThreshold: 0.5,
  sentimentFilter: null // null (disabled), 1 (positive), -1 (negative)
};

// Worker 主线程消息监听
self.onmessage = async function(event) {
  const { type, data, modelPath, config } = event.data;
  
  // 处理初始化请求
  if (type === 'init') {
    try {
      // Initialize ONNX runtime session
      session = await ort.InferenceSession.create(modelPath);
      
      // Initialize tokenizer
      tokenizer = new Tokenizer(); // Assuming Tokenizer is available globally
      await tokenizer.initialize(); // Assuming an async initialize method
      
      isModelLoaded = true;
      
      self.postMessage({ 
        type: 'model_loaded',
        success: true
      });
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        message: `模型加载失败: ${error.message}` // Consistent error reporting
      });
    }
    return;
  }
  
  // 更新处理配置
  if (type === 'update_config') {
    if (config) {
      currentProcessingConfig = config; // Store the received config
      self.postMessage({ 
        type: 'config_updated',
        success: true,
        data: currentProcessingConfig // Send back the applied config
      });
    } else {
      self.postMessage({
        type: 'config_updated',
        success: false,
        message: 'No config provided in update_config message'
      });
    }
    return;
  }
  
  // 处理弹幕
  if (type === 'process_danmu') {
    try {
      if (!isModelLoaded) {
        // Post an error message back if the model isn't loaded
        self.postMessage({
          type: 'error',
          message: '模型未加载，无法处理弹幕'
        });
        return;
      }
      
      const danmuList = data;
      
      if (!Array.isArray(danmuList) || danmuList.length === 0) {
        self.postMessage({ 
          type: 'processed_danmu', 
          data: []
        });
        return;
      }
      
      // 处理弹幕
      const processedDanmu = await processDanmuWithModel(danmuList);
      
      self.postMessage({
        type: 'processed_danmu',
        data: processedDanmu
      });
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        message: `处理弹幕失败: ${error.message}` // Consistent error reporting
      });
    }
    return;
  }
};

/**
 * Scores a single danmu text using the ONNX model.
 * @param {string} text The danmu text to score.
 * @returns {Promise<Object>} A promise that resolves to an object with scores (e.g., sentiment, interestingness, relevance).
 */
async function scoreDanmu(text) {
  if (!session || !tokenizer) {
    throw new Error('ONNX session or tokenizer not initialized');
  }
  const encodedInput = tokenizer.encode(text); // Assuming encode method exists

  // Prepare feeds (adjust 'input_ids' and 'attention_mask' based on your model's actual input names)
  const feeds = {
    // Ensure the names here match your model's expected input names
    input_ids: new ort.Tensor('int64', encodedInput.input_ids, [1, encodedInput.input_ids.length]),
    attention_mask: new ort.Tensor('int64', encodedInput.attention_mask, [1, encodedInput.attention_mask.length])
  };

  // Run inference
  const results = await session.run(feeds);

  // Process results (this is a placeholder and depends on your model's output structure)
  // For example, if your model outputs an object with these properties:
  // const outputTensor = results.output; // or results[modelOutputName]
  // return {
  //   sentiment: outputTensor.data[0], 
  //   interestingness: outputTensor.data[1],
  //   relevance: outputTensor.data[2]
  // };

  // Placeholder: adjust based on actual model output structure
  // Assuming the model has an output named 'output' (common default)
  // and this output tensor contains the scores in a specific order.
  const outputData = results.output.data; // Accessing data from the first output tensor
  return {
    sentiment: outputData[0],       // Example: first element is sentiment
    interestingness: outputData[1], // Example: second element is interestingness
    relevance: outputData[2]        // Example: third element is relevance
  };
}

/**
 * 使用模型处理弹幕
 * @param {Array} danmuList 弹幕列表
 * @returns {Promise<Array>} 处理后的弹幕列表
 */
async function processDanmuWithModel(danmuList) {
  const processedList = [];
  
  for (const danmu of danmuList) {
    const scores = await scoreDanmu(danmu.content); // Use the new scoring function
    
    // 根据阈值过滤 (using locally stored config)
    if (scores.interestingness >= currentProcessingConfig.interestingnessThreshold &&
        scores.relevance >= currentProcessingConfig.relevanceThreshold) {
        
      // 情感过滤（如果启用） (using locally stored config)
      if (currentProcessingConfig.sentimentFilter !== null) {
        const isPositive = scores.sentiment > 0.5; // Assuming sentiment > 0.5 is positive
        const shouldKeepPositive = currentProcessingConfig.sentimentFilter > 0;
        
        if (isPositive !== shouldKeepPositive) {
          continue; // 跳过不符合情感过滤条件的弹幕
        }
      }
      
      // 添加到结果列表
      processedList.push({
        ...danmu,
        scores
      });
    }
  }
  
  return processedList;
}
