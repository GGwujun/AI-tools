const SERVICE_CONFIG = {
  baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
  apiKey: 'f9ff2dfa21804ed8bdeeb511deaf888b.M0YaO5MyJ5Xa5Wvs',
  model: 'glm-4.6v'
};

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

function readFileBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}

function normalizeContent(content) {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('\n');
  }

  return '';
}

function extractJsonText(rawText) {
  const text = String(rawText || '').trim().replace(/```json|```/gi, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRegion(region, index) {
  const x = clamp(Math.round(Number(region?.x) || 0), 0, 980);
  const y = clamp(Math.round(Number(region?.y) || 0), 0, 980);
  const width = clamp(Math.round(Number(region?.width) || 0), 20, 1000 - x);
  const height = clamp(Math.round(Number(region?.height) || 0), 20, 1000 - y);
  const confidence = clamp(Math.round(Number(region?.confidence) || 0), 1, 100);
  const label = String(region?.label || `候选区域 ${index + 1}`).slice(0, 12);

  return {
    id: `region_${index + 1}`,
    label,
    x,
    y,
    width,
    height,
    confidence
  };
}

function parseRegions(rawText) {
  const jsonText = extractJsonText(rawText);
  const parsed = JSON.parse(jsonText);
  const regions = Array.isArray(parsed?.regions) ? parsed.regions : [];

  return {
    regions: regions
      .map((region, index) => normalizeRegion(region, index))
      .filter((region) => region.width > 0 && region.height > 0)
      .slice(0, 4),
    summary: String(parsed?.summary || '').slice(0, 80)
  };
}

async function detectWatermarkRegions(imagePath) {
  const base64Data = await readFileBase64(imagePath);
  const response = await request({
    url: `${SERVICE_CONFIG.baseUrl}/chat/completions`,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_CONFIG.apiKey}`
    },
    data: {
      model: SERVICE_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            },
            {
              type: 'text',
              text: [
                '请只识别最值得优先处理的水印或遮挡区域。',
                '目标类型包括：角落 logo、账号名、日期、半透明水印条、居中贴纸。',
                '忽略正文、大段字幕和不需要去除的主体内容。',
                '返回严格 JSON，不要 markdown，不要解释。',
                '格式：{"regions":[{"label":"角标","x":120,"y":80,"width":180,"height":90,"confidence":92}],"summary":"一句短总结"}',
                '坐标使用 0-1000 的归一化整数。最多返回 4 个区域。'
              ].join('')
            }
          ]
        }
      ],
      stream: false
    }
  });

  if (response.statusCode !== 200 || !response.data?.choices?.[0]) {
    throw new Error('detect request failed');
  }

  const content = normalizeContent(response.data.choices[0].message?.content);
  const parsed = parseRegions(content);

  if (!parsed.regions.length) {
    throw new Error('no detectable watermark regions');
  }

  return parsed;
}

module.exports = {
  detectWatermarkRegions
};
