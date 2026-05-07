const storage = require('../../../utils/safe-storage');
const { detectWatermarkRegions } = require('../../../utils/watermark-detector');

const MASK_ALPHA_THRESHOLD = 8;
const BRUSH_PRESETS = [
  { id: 'fine', label: '精细', size: 14 },
  { id: 'normal', label: '标准', size: 24 },
  { id: 'wide', label: '大范围', size: 36 }
];
const REPAIR_MODES = {
  quick: {
    id: 'quick',
    label: '快速',
    maxExportSize: 1080,
    paddingFactor: 1.6,
    smoothPasses: 1
  },
  balanced: {
    id: 'balanced',
    label: '均衡',
    maxExportSize: 1280,
    paddingFactor: 2.2,
    smoothPasses: 2
  },
  deep: {
    id: 'deep',
    label: '增强',
    maxExportSize: 1440,
    paddingFactor: 3,
    smoothPasses: 3
  }
};
const SELECTION_TEMPLATES = [
  { id: 'topLeft', label: '左上角' },
  { id: 'topRight', label: '右上角' },
  { id: 'bottomLeft', label: '左下角' },
  { id: 'bottomRight', label: '右下角' },
  { id: 'bottomStrip', label: '底部条' },
  { id: 'centerBadge', label: '中部贴纸' }
];
const TEMPLATE_SIZES = [
  {
    id: 'tight',
    label: '紧凑',
    cornerWidthRatio: 0.18,
    cornerHeightRatio: 0.14,
    stripWidthRatio: 0.72,
    stripHeightRatio: 0.12,
    centerWidthRatio: 0.28,
    centerHeightRatio: 0.18
  },
  {
    id: 'standard',
    label: '标准',
    cornerWidthRatio: 0.24,
    cornerHeightRatio: 0.18,
    stripWidthRatio: 0.82,
    stripHeightRatio: 0.16,
    centerWidthRatio: 0.38,
    centerHeightRatio: 0.24
  },
  {
    id: 'wide',
    label: '扩大',
    cornerWidthRatio: 0.3,
    cornerHeightRatio: 0.22,
    stripWidthRatio: 0.9,
    stripHeightRatio: 0.2,
    centerWidthRatio: 0.5,
    centerHeightRatio: 0.3
  }
];

function getWatermarkStats() {
  const stats = storage.get('watermarkStats');
  return {
    videoParses: stats?.videoParses || 0,
    imageErases: stats?.imageErases || 0
  };
}

function setWatermarkStats(stats) {
  storage.set('watermarkStats', stats);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success: resolve,
      fail: reject
    });
  });
}

function drawContext(ctx, reserve = false) {
  return new Promise((resolve) => {
    ctx.draw(reserve, resolve);
  });
}

function getCanvasImageData(canvasId, width, height, x = 0, y = 0) {
  return new Promise((resolve, reject) => {
    wx.canvasGetImageData({
      canvasId,
      x,
      y,
      width,
      height,
      success: resolve,
      fail: reject
    });
  });
}

function putCanvasImageData(canvasId, data, width, height, x = 0, y = 0) {
  return new Promise((resolve, reject) => {
    wx.canvasPutImageData({
      canvasId,
      x,
      y,
      width,
      height,
      data,
      success: resolve,
      fail: reject
    });
  });
}

function exportCanvasFile(canvasId, width, height) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvasId,
      x: 0,
      y: 0,
      width,
      height,
      destWidth: width,
      destHeight: height,
      fileType: 'png',
      quality: 1,
      success: resolve,
      fail: reject
    });
  });
}

function getStrokeCount(points) {
  let count = 0;
  let inStroke = false;

  for (const point of points) {
    if (point._end) {
      inStroke = false;
      continue;
    }

    if (!inStroke) {
      count += 1;
      inStroke = true;
    }
  }

  return count;
}

function removeLastStrokePoints(points) {
  const nextPoints = points.slice();

  while (nextPoints.length && nextPoints[nextPoints.length - 1]._end) {
    nextPoints.pop();
  }

  while (nextPoints.length && !nextPoints[nextPoints.length - 1]._end) {
    nextPoints.pop();
  }

  while (nextPoints.length && nextPoints[nextPoints.length - 1]._end) {
    nextPoints.pop();
  }

  return nextPoints;
}

function createGlobalAverage(buffer, mask) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalA = 0;
  let count = 0;

  for (let index = 0; index < mask.length; index++) {
    if (mask[index]) continue;

    const base = index * 4;
    totalR += buffer[base];
    totalG += buffer[base + 1];
    totalB += buffer[base + 2];
    totalA += buffer[base + 3];
    count += 1;
  }

  if (!count) {
    return { r: 255, g: 255, b: 255, a: 255 };
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
    a: Math.round(totalA / count)
  };
}

function collectNeighborAverage(buffer, pending, width, height, x, y) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalA = 0;
  let count = 0;

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      if (offsetX === 0 && offsetY === 0) continue;

      const nextX = x + offsetX;
      const nextY = y + offsetY;

      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        continue;
      }

      const nextIndex = nextY * width + nextX;
      if (pending[nextIndex]) {
        continue;
      }

      const nextBase = nextIndex * 4;
      totalR += buffer[nextBase];
      totalG += buffer[nextBase + 1];
      totalB += buffer[nextBase + 2];
      totalA += buffer[nextBase + 3];
      count += 1;
    }
  }

  if (!count) {
    return null;
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
    a: Math.round(totalA / count)
  };
}

function collectSmoothedAverage(buffer, width, height, x, y) {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalA = 0;
  let count = 0;

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      const nextX = x + offsetX;
      const nextY = y + offsetY;

      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
        continue;
      }

      const nextIndex = nextY * width + nextX;
      const nextBase = nextIndex * 4;
      totalR += buffer[nextBase];
      totalG += buffer[nextBase + 1];
      totalB += buffer[nextBase + 2];
      totalA += buffer[nextBase + 3];
      count += 1;
    }
  }

  if (!count) {
    return null;
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
    a: Math.round(totalA / count)
  };
}

function inpaintMaskedArea(imageData, maskData, width, height, smoothPasses) {
  const buffer = new Uint8ClampedArray(imageData.data);
  const pixelCount = width * height;
  const mask = new Uint8Array(pixelCount);
  const pending = new Uint8Array(pixelCount);
  let maskedCount = 0;

  for (let index = 0; index < pixelCount; index++) {
    if (maskData.data[index * 4 + 3] > MASK_ALPHA_THRESHOLD) {
      mask[index] = 1;
      pending[index] = 1;
      maskedCount += 1;
    }
  }

  if (!maskedCount) {
    return imageData;
  }

  const globalAverage = createGlobalAverage(buffer, mask);
  const queue = [];

  const tryFillPixel = (index) => {
    if (!pending[index]) return false;

    const x = index % width;
    const y = Math.floor(index / width);
    const color = collectNeighborAverage(buffer, pending, width, height, x, y);
    if (!color) {
      return false;
    }

    const base = index * 4;
    buffer[base] = color.r;
    buffer[base + 1] = color.g;
    buffer[base + 2] = color.b;
    buffer[base + 3] = color.a || 255;
    pending[index] = 0;
    queue.push(index);
    return true;
  };

  for (let index = 0; index < pixelCount; index++) {
    if (pending[index]) {
      tryFillPixel(index);
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = index % width;
    const y = Math.floor(index / width);

    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        if (offsetX === 0 && offsetY === 0) continue;

        const nextX = x + offsetX;
        const nextY = y + offsetY;

        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
          continue;
        }

        const nextIndex = nextY * width + nextX;
        if (pending[nextIndex]) {
          tryFillPixel(nextIndex);
        }
      }
    }
  }

  for (let index = 0; index < pixelCount; index++) {
    if (!pending[index]) continue;

    const base = index * 4;
    buffer[base] = globalAverage.r;
    buffer[base + 1] = globalAverage.g;
    buffer[base + 2] = globalAverage.b;
    buffer[base + 3] = globalAverage.a;
  }

  for (let pass = 0; pass < smoothPasses; pass++) {
    const nextBuffer = new Uint8ClampedArray(buffer);

    for (let index = 0; index < pixelCount; index++) {
      if (!mask[index]) continue;

      const x = index % width;
      const y = Math.floor(index / width);
      const color = collectSmoothedAverage(buffer, width, height, x, y);
      if (!color) continue;

      const base = index * 4;
      nextBuffer[base] = color.r;
      nextBuffer[base + 1] = color.g;
      nextBuffer[base + 2] = color.b;
      nextBuffer[base + 3] = 255;
    }

    buffer.set(nextBuffer);
  }

  imageData.data.set(buffer);
  return imageData;
}

function buildSelectionStage(coverage) {
  if (!coverage) return '尚未标记选区';
  if (coverage < 8) return '适合精细修复';
  if (coverage < 18) return '适合标准修复';
  return '建议收窄选区后再处理';
}

function buildModeSuggestion(coverage, repairMode) {
  const recommendedMode = coverage < 8 ? 'quick' : coverage < 18 ? 'balanced' : 'deep';
  const currentLabel = REPAIR_MODES[repairMode]?.label || '均衡';
  const recommendedLabel = REPAIR_MODES[recommendedMode]?.label || '均衡';

  return {
    current: currentLabel,
    recommended: recommendedLabel,
    text: repairMode === recommendedMode
      ? `当前 ${currentLabel} 模式和选区规模基本匹配。`
      : `当前更建议切换到 ${recommendedLabel} 模式，以获得更稳的修复表现。`
  };
}

function buildDefaultModeSuggestion(repairMode) {
  return {
    current: REPAIR_MODES[repairMode]?.label || '均衡',
    recommended: '均衡',
    text: '先标记水印区域，再根据面积选择修复模式。'
  };
}

function getTemplateSizeConfig(sizeId) {
  return TEMPLATE_SIZES.find((item) => item.id === sizeId) || TEMPLATE_SIZES[1];
}

function buildTemplateRect(editorMetrics, templateId, sizeId) {
  if (!editorMetrics) return null;

  const size = getTemplateSizeConfig(sizeId);
  const { offsetX, offsetY, displayWidth, displayHeight } = editorMetrics;
  const rightEdge = offsetX + displayWidth;
  const bottomEdge = offsetY + displayHeight;
  const cornerWidth = displayWidth * size.cornerWidthRatio;
  const cornerHeight = displayHeight * size.cornerHeightRatio;
  const stripWidth = displayWidth * size.stripWidthRatio;
  const stripHeight = displayHeight * size.stripHeightRatio;
  const centerWidth = displayWidth * size.centerWidthRatio;
  const centerHeight = displayHeight * size.centerHeightRatio;

  const rectMap = {
    topLeft: {
      x: offsetX,
      y: offsetY,
      width: cornerWidth,
      height: cornerHeight
    },
    topRight: {
      x: rightEdge - cornerWidth,
      y: offsetY,
      width: cornerWidth,
      height: cornerHeight
    },
    bottomLeft: {
      x: offsetX,
      y: bottomEdge - cornerHeight,
      width: cornerWidth,
      height: cornerHeight
    },
    bottomRight: {
      x: rightEdge - cornerWidth,
      y: bottomEdge - cornerHeight,
      width: cornerWidth,
      height: cornerHeight
    },
    bottomStrip: {
      x: offsetX + (displayWidth - stripWidth) / 2,
      y: bottomEdge - stripHeight,
      width: stripWidth,
      height: stripHeight
    },
    centerBadge: {
      x: offsetX + (displayWidth - centerWidth) / 2,
      y: offsetY + (displayHeight - centerHeight) / 2,
      width: centerWidth,
      height: centerHeight
    }
  };

  return rectMap[templateId] || null;
}

function createTemplateBrushPoints(rect, brushSize) {
  if (!rect) return [];

  const points = [];
  const radius = Math.max(brushSize / 2, 4);
  const top = rect.y + radius;
  const bottom = Math.max(top, rect.y + rect.height - radius);
  const left = rect.x + radius;
  const right = Math.max(left, rect.x + rect.width - radius);
  const rowSpacing = Math.max(8, Math.floor(brushSize * 0.72));

  for (let rowY = top; rowY <= bottom; rowY += rowSpacing) {
    points.push({ x: left, y: rowY });
    if (right > left) {
      points.push({ x: right, y: rowY });
    }
    points.push({ _end: true });
  }

  if (!points.length) {
    points.push({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    });
    points.push({ _end: true });
  }

  return points;
}

function mergeBrushPointGroups(existingPoints, nextPoints) {
  const merged = existingPoints.slice();

  if (merged.length && !merged[merged.length - 1]._end) {
    merged.push({ _end: true });
  }

  return merged.concat(nextPoints);
}

function cloneBrushPoints(points) {
  return points.map((point) => ({ ...point }));
}

function buildDefaultDetectionSummary() {
  return '可自动识别常见文字水印、角标和底部水印条，再按建议一键套用。';
}

function describeNormalizedRegion(region) {
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;

  if (region.width > 520 && region.height < 220 && centerY > 650) {
    return '接近底部横条';
  }

  if (centerY < 330 && centerX < 330) return '位于左上区域';
  if (centerY < 330 && centerX > 670) return '位于右上区域';
  if (centerY > 670 && centerX < 330) return '位于左下区域';
  if (centerY > 670 && centerX > 670) return '位于右下区域';
  return '位于画面中部';
}

Page({
  data: {
    selectedImage: '',
    resultImage: '',
    previewSource: 'result',
    compareRatio: 50,
    brushSize: BRUSH_PRESETS[1].size,
    brushPresets: BRUSH_PRESETS,
    activeBrushPreset: BRUSH_PRESETS[1].id,
    repairModes: Object.values(REPAIR_MODES),
    repairMode: 'balanced',
    selectionTemplates: SELECTION_TEMPLATES,
    templateSizes: TEMPLATE_SIZES.map(({ id, label }) => ({ id, label })),
    activeTemplateSize: TEMPLATE_SIZES[1].id,
    isDetectingRegions: false,
    detectedRegions: [],
    detectionSummary: buildDefaultDetectionSummary(),
    brushPoints: [],
    redoDepth: 0,
    strokeCount: 0,
    selectionCoverage: 0,
    selectionStage: '尚未标记选区',
    modeSuggestion: buildDefaultModeSuggestion('balanced'),
    detailSignals: [
      { title: '先小后大', desc: '先框住核心水印，尽量不要把无关背景一起刷进去。' },
      { title: '模板先行', desc: '角标、水印条、居中贴纸可先点模板，再用笔刷微调边缘。' },
      { title: '纹理复杂用增强', desc: '人物、布料、商品边缘这类画面更适合增强模式。' },
      { title: '结果不理想先重画', desc: '选区过宽时先撤销并缩小范围，通常比盲目重跑更有效。' }
    ],
    isProcessing: false,
    canvasDisplayWidth: 300,
    canvasDisplayHeight: 300,
    processCanvasWidth: 1,
    processCanvasHeight: 1
  },

  onLoad() {
    this.imageInfo = null;
    this.editorMetrics = null;
    this.redoStack = [];
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles[0];
        const tempFilePath = file.tempFilePath;

        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({ title: '图片超过 10MB', icon: 'none' });
          return;
        }

        try {
          const imageInfo = await getImageInfo(tempFilePath);
          this.imageInfo = {
            path: imageInfo.path || tempFilePath,
            width: imageInfo.width,
            height: imageInfo.height
          };

          this.setData({
            selectedImage: tempFilePath,
            resultImage: '',
            previewSource: 'result',
            compareRatio: 50,
            detectedRegions: [],
            detectionSummary: buildDefaultDetectionSummary(),
            isDetectingRegions: false,
            brushPoints: [],
            redoDepth: 0,
            strokeCount: 0,
            selectionCoverage: 0
          }, () => {
            this.clearRedoStack();
            this.measureEditor();
          });
        } catch (error) {
          console.error('读取图片信息失败', error);
          wx.showToast({ title: '读取图片失败', icon: 'none' });
        }
      },
      fail: (error) => {
        console.error('选择图片失败', error);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  onBrushSizeChange(e) {
    this.setData({
      brushSize: parseInt(e.detail.value, 10),
      activeBrushPreset: '',
      resultImage: this.data.brushPoints.length ? '' : this.data.resultImage
    });
    this.drawBrushStroke();
    this.refreshSelectionMeta(this.data.brushPoints);
  },

  applyBrushPreset(e) {
    const { id, size } = e.currentTarget.dataset;
    this.setData({
      activeBrushPreset: id,
      brushSize: Number(size),
      resultImage: this.data.brushPoints.length ? '' : this.data.resultImage
    });
    this.drawBrushStroke();
    this.refreshSelectionMeta(this.data.brushPoints);
  },

  setRepairMode(e) {
    const { mode } = e.currentTarget.dataset;
    if (!mode || this.data.repairMode === mode) return;
    this.setData({ repairMode: mode }, () => {
      this.refreshSelectionMeta(this.data.brushPoints);
    });
  },

  setTemplateSize(e) {
    const { sizeId } = e.currentTarget.dataset;
    if (!sizeId || this.data.activeTemplateSize === sizeId) return;
    this.setData({ activeTemplateSize: sizeId });
  },

  getDisplayRectFromDetectedRegion(region) {
    if (!this.editorMetrics || !region) return null;

    const { offsetX, offsetY, displayWidth, displayHeight } = this.editorMetrics;
    const x = offsetX + displayWidth * (region.x / 1000);
    const y = offsetY + displayHeight * (region.y / 1000);
    const width = displayWidth * (region.width / 1000);
    const height = displayHeight * (region.height / 1000);

    return {
      x,
      y,
      width,
      height
    };
  },

  applySelectionTemplate(e) {
    const { templateId } = e.currentTarget.dataset;
    if (!templateId) return;

    if (!this.data.selectedImage) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    if (!this.editorMetrics) {
      this.measureEditor();
      wx.showToast({ title: '编辑区域准备中，请稍后再试', icon: 'none' });
      return;
    }

    const rect = buildTemplateRect(this.editorMetrics, templateId, this.data.activeTemplateSize);
    const templatePoints = createTemplateBrushPoints(rect, this.data.brushSize);
    if (!templatePoints.length) return;
    this.clearRedoStack();

    this.applyBrushPoints(
      mergeBrushPointGroups(this.data.brushPoints, templatePoints),
      true
    );
  },

  async detectWatermarkSuggestions() {
    if (!this.data.selectedImage) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    if (this.data.isDetectingRegions) return;

    this.setData({ isDetectingRegions: true });
    wx.showLoading({ title: '识别区域中...' });

    try {
      const result = await detectWatermarkRegions(this.data.selectedImage);
      const detectedRegions = result.regions.map((region) => ({
        ...region,
        confidenceText: `${region.confidence}%`,
        note: describeNormalizedRegion(region)
      }));

      this.setData({
        detectedRegions,
        detectionSummary: result.summary || `已找到 ${detectedRegions.length} 个优先处理区域`
      });

      wx.showToast({
        title: `已找到 ${detectedRegions.length} 个区域`,
        icon: 'success'
      });
    } catch (error) {
      console.error('识别候选区域失败', error);
      this.setData({
        detectedRegions: [],
        detectionSummary: '暂未识别到明显候选区域，可改用模板选区或手动涂抹。'
      });
      wx.showToast({
        title: '未识别到候选区域',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
      this.setData({ isDetectingRegions: false });
    }
  },

  applyDetectedRegion(e) {
    const { regionId } = e.currentTarget.dataset;
    const region = this.data.detectedRegions.find((item) => item.id === regionId);
    if (!region) return;

    if (!this.editorMetrics) {
      this.measureEditor();
      wx.showToast({ title: '编辑区域准备中，请稍后重试', icon: 'none' });
      return;
    }

    const rect = this.getDisplayRectFromDetectedRegion(region);
    const points = createTemplateBrushPoints(rect, this.data.brushSize);
    if (!points.length) return;
    this.clearRedoStack();

    this.applyBrushPoints(
      mergeBrushPointGroups(this.data.brushPoints, points),
      true
    );
  },

  applyAllDetectedRegions() {
    if (!this.data.detectedRegions.length) return;

    if (!this.editorMetrics) {
      this.measureEditor();
      wx.showToast({ title: '编辑区域准备中，请稍后重试', icon: 'none' });
      return;
    }

    let nextPoints = this.data.brushPoints.slice();
    this.clearRedoStack();

    this.data.detectedRegions.forEach((region) => {
      const rect = this.getDisplayRectFromDetectedRegion(region);
      const points = createTemplateBrushPoints(rect, this.data.brushSize);
      nextPoints = mergeBrushPointGroups(nextPoints, points);
    });

    this.applyBrushPoints(nextPoints, true);
  },

  setPreviewSource(e) {
    const { source } = e.currentTarget.dataset;
    if (!source) return;
    this.setData({ previewSource: source });
  },

  onCompareRatioChange(e) {
    this.setData({
      compareRatio: Number(e.detail.value || 50)
    });
  },

  measureEditor(retryCount = 0) {
    if (!this.imageInfo) return;

    wx.createSelectorQuery()
      .select('.image-wrapper')
      .boundingClientRect((rect) => {
        if (!rect) {
          if (retryCount < 6) {
            setTimeout(() => this.measureEditor(retryCount + 1), 80);
          }
          return;
        }

        const scale = Math.min(rect.width / this.imageInfo.width, rect.height / this.imageInfo.height);
        const displayWidth = this.imageInfo.width * scale;
        const displayHeight = this.imageInfo.height * scale;

        this.editorMetrics = {
          left: rect.left,
          top: rect.top,
          wrapperWidth: rect.width,
          wrapperHeight: rect.height,
          displayWidth,
          displayHeight,
          offsetX: (rect.width - displayWidth) / 2,
          offsetY: (rect.height - displayHeight) / 2
        };

        this.setData({
          canvasDisplayWidth: Math.round(rect.width),
          canvasDisplayHeight: Math.round(rect.height)
        }, () => {
          this.clearOverlayCanvas();
          this.drawBrushStroke();
          this.refreshSelectionMeta(this.data.brushPoints);
        });
      })
      .exec();
  },

  getLocalTouchPoint(touch) {
    if (!this.editorMetrics) return null;

    let localX = touch.x ?? 0;
    let localY = touch.y ?? 0;

    if (touch.clientX !== undefined || touch.pageX !== undefined) {
      const clientX = touch.clientX ?? touch.pageX ?? 0;
      const clientY = touch.clientY ?? touch.pageY ?? 0;
      localX = clientX - this.editorMetrics.left;
      localY = clientY - this.editorMetrics.top;
    }

    return {
      x: clamp(localX, 0, this.editorMetrics.wrapperWidth),
      y: clamp(localY, 0, this.editorMetrics.wrapperHeight)
    };
  },

  applyBrushPoints(brushPoints, shouldClearResult = true) {
    this.setData({
      brushPoints,
      strokeCount: getStrokeCount(brushPoints),
      resultImage: shouldClearResult ? '' : this.data.resultImage
    });
    this.drawBrushStroke();
    this.refreshSelectionMeta(brushPoints);
  },

  clearRedoStack() {
    this.redoStack = [];
    this.setData({ redoDepth: 0 });
  },

  onCanvasStart(e) {
    const point = this.getLocalTouchPoint(e.touches[0] || {});
    if (!point) return;
    this.clearRedoStack();

    this.applyBrushPoints(
      this.data.brushPoints.concat(point),
      !!this.data.resultImage
    );
  },

  onCanvasMove(e) {
    const point = this.getLocalTouchPoint(e.touches[0] || {});
    if (!point) return;

    this.applyBrushPoints(
      this.data.brushPoints.concat(point),
      !!this.data.resultImage
    );
  },

  onCanvasEnd() {
    const points = this.data.brushPoints;
    if (!points.length || points[points.length - 1]._end) {
      return;
    }

    this.applyBrushPoints(points.concat({ _end: true }), !!this.data.resultImage);
  },

  undoLastStroke() {
    if (!this.data.strokeCount) return;
    this.redoStack.push(cloneBrushPoints(this.data.brushPoints));
    this.setData({ redoDepth: this.redoStack.length });
    this.applyBrushPoints(removeLastStrokePoints(this.data.brushPoints), true);
  },

  redoLastStroke() {
    if (!this.redoStack.length) return;
    const nextPoints = this.redoStack.pop();
    this.setData({ redoDepth: this.redoStack.length });
    this.applyBrushPoints(nextPoints, true);
  },

  drawBrushStroke() {
    const ctx = wx.createCanvasContext('drawCanvas');
    const { brushSize, brushPoints, canvasDisplayWidth, canvasDisplayHeight } = this.data;

    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);
    ctx.setStrokeStyle('rgba(15, 118, 110, 0.72)');
    ctx.setFillStyle('rgba(15, 118, 110, 0.72)');
    ctx.setLineWidth(brushSize);
    ctx.setLineCap('round');
    ctx.setLineJoin('round');

    let lastPoint = null;

    for (const point of brushPoints) {
      if (point._end) {
        lastPoint = null;
        continue;
      }

      if (lastPoint) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      lastPoint = point;
    }

    ctx.draw();
  },

  resetCanvas(clearResult = true) {
    const nextData = {
      brushPoints: [],
      strokeCount: 0,
      selectionCoverage: 0
    };

    if (clearResult) {
      nextData.resultImage = '';
    }

    this.setData(nextData);

    this.clearOverlayCanvas();
    this.refreshSelectionMeta([]);
    this.clearRedoStack();
  },

  clearOverlayCanvas() {
    const ctx = wx.createCanvasContext('drawCanvas');
    ctx.clearRect(0, 0, this.data.canvasDisplayWidth, this.data.canvasDisplayHeight);
    ctx.draw();
  },

  refreshSelectionMeta(points) {
    if (!this.editorMetrics || !points.length) {
      this.setData({
        selectionCoverage: points.length ? this.data.selectionCoverage : 0,
        selectionStage: points.length ? this.data.selectionStage : '尚未标记选区',
        modeSuggestion: points.length
          ? this.data.modeSuggestion
          : buildDefaultModeSuggestion(this.data.repairMode)
      });
      return;
    }

    const bounds = this.getMaskBoundsInDisplay(points);
    if (!bounds) {
      this.setData({
        selectionCoverage: 0,
        selectionStage: '尚未标记选区',
        modeSuggestion: buildDefaultModeSuggestion(this.data.repairMode)
      });
      return;
    }

    const totalArea = this.editorMetrics.displayWidth * this.editorMetrics.displayHeight || 1;
    const selectedArea = bounds.width * bounds.height;
    const coverage = clamp(Math.round((selectedArea / totalArea) * 100), 0, 100);
    this.setData({
      selectionCoverage: coverage,
      selectionStage: buildSelectionStage(coverage),
      modeSuggestion: buildModeSuggestion(coverage, this.data.repairMode)
    });
  },

  getMaskBoundsInDisplay(points) {
    if (!this.editorMetrics) return null;

    const { displayWidth, displayHeight, offsetX, offsetY } = this.editorMetrics;
    const radius = this.data.brushSize / 2;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      if (point._end) continue;

      const x = clamp(point.x - offsetX, 0, displayWidth);
      const y = clamp(point.y - offsetY, 0, displayHeight);
      minX = Math.min(minX, clamp(x - radius, 0, displayWidth));
      minY = Math.min(minY, clamp(y - radius, 0, displayHeight));
      maxX = Math.max(maxX, clamp(x + radius, 0, displayWidth));
      maxY = Math.max(maxY, clamp(y + radius, 0, displayHeight));
    }

    if (!Number.isFinite(minX)) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  },

  getActiveRepairMode() {
    return REPAIR_MODES[this.data.repairMode] || REPAIR_MODES.balanced;
  },

  getMaskBoundsInProcess(width, height, scale, modeConfig) {
    const brushRadius = Math.max(3, this.data.brushSize * scale / 2);
    const padding = Math.max(8, Math.round(brushRadius * modeConfig.paddingFactor));
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of this.data.brushPoints) {
      if (point._end) continue;

      const nextPoint = this.transformPointToProcess(point, width, height);
      minX = Math.min(minX, nextPoint.x - brushRadius - padding);
      minY = Math.min(minY, nextPoint.y - brushRadius - padding);
      maxX = Math.max(maxX, nextPoint.x + brushRadius + padding);
      maxY = Math.max(maxY, nextPoint.y + brushRadius + padding);
    }

    if (!Number.isFinite(minX)) {
      return null;
    }

    const x = clamp(Math.floor(minX), 0, width - 1);
    const y = clamp(Math.floor(minY), 0, height - 1);
    const right = clamp(Math.ceil(maxX), x + 1, width);
    const bottom = clamp(Math.ceil(maxY), y + 1, height);

    return {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y)
    };
  },

  async startProcess() {
    const { selectedImage, brushPoints } = this.data;

    if (!selectedImage) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }

    if (!brushPoints.some((point) => !point._end)) {
      wx.showToast({ title: '请先涂抹需要去除的区域', icon: 'none' });
      return;
    }

    if (!this.imageInfo || !this.editorMetrics) {
      wx.showToast({ title: '图片尚未准备完成', icon: 'none' });
      this.measureEditor();
      return;
    }

    const modeConfig = this.getActiveRepairMode();

    this.setData({ isProcessing: true });
    wx.showLoading({ title: `${modeConfig.label}处理中...` });

    try {
      const scale = Math.min(1, modeConfig.maxExportSize / Math.max(this.imageInfo.width, this.imageInfo.height));
      const processCanvasWidth = Math.max(1, Math.round(this.imageInfo.width * scale));
      const processCanvasHeight = Math.max(1, Math.round(this.imageInfo.height * scale));

      await new Promise((resolve) => {
        this.setData({
          processCanvasWidth,
          processCanvasHeight
        }, resolve);
      });

      await this.drawSourceImage(processCanvasWidth, processCanvasHeight);
      await this.drawMaskCanvas(processCanvasWidth, processCanvasHeight);

      const cropBounds = this.getMaskBoundsInProcess(processCanvasWidth, processCanvasHeight, processCanvasWidth / this.editorMetrics.displayWidth, modeConfig);
      if (!cropBounds) {
        throw new Error('No mask bounds found');
      }

      const imageData = await getCanvasImageData('processCanvas', cropBounds.width, cropBounds.height, cropBounds.x, cropBounds.y);
      const maskData = await getCanvasImageData('maskCanvas', cropBounds.width, cropBounds.height, cropBounds.x, cropBounds.y);
      const processedImageData = inpaintMaskedArea(
        imageData,
        maskData,
        cropBounds.width,
        cropBounds.height,
        modeConfig.smoothPasses
      );

      await putCanvasImageData(
        'processCanvas',
        processedImageData.data,
        cropBounds.width,
        cropBounds.height,
        cropBounds.x,
        cropBounds.y
      );

      const exported = await exportCanvasFile('processCanvas', processCanvasWidth, processCanvasHeight);

      this.setData({
        resultImage: exported.tempFilePath,
        previewSource: 'result'
      });

      this.updateStats();
      wx.showToast({ title: '处理完成', icon: 'success' });
    } catch (error) {
      console.error('图片去水印失败', error);
      wx.showToast({ title: '处理失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ isProcessing: false });
    }
  },

  async drawSourceImage(width, height) {
    const ctx = wx.createCanvasContext('processCanvas');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(this.imageInfo.path || this.data.selectedImage, 0, 0, width, height);
    await drawContext(ctx);
  },

  transformPointToProcess(point, targetWidth, targetHeight) {
    const { displayWidth, displayHeight, offsetX, offsetY } = this.editorMetrics;
    const relativeX = clamp((point.x - offsetX) / displayWidth, 0, 1);
    const relativeY = clamp((point.y - offsetY) / displayHeight, 0, 1);

    return {
      x: relativeX * targetWidth,
      y: relativeY * targetHeight
    };
  },

  async drawMaskCanvas(width, height) {
    const ctx = wx.createCanvasContext('maskCanvas');
    ctx.clearRect(0, 0, width, height);
    ctx.setStrokeStyle('rgba(255,255,255,1)');
    ctx.setFillStyle('rgba(255,255,255,1)');
    ctx.setLineCap('round');
    ctx.setLineJoin('round');

    const scale = width / this.editorMetrics.displayWidth;
    ctx.setLineWidth(Math.max(6, this.data.brushSize * scale));

    let lastPoint = null;
    for (const point of this.data.brushPoints) {
      if (point._end) {
        lastPoint = null;
        continue;
      }

      const nextPoint = this.transformPointToProcess(point, width, height);

      if (lastPoint) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(nextPoint.x, nextPoint.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(nextPoint.x, nextPoint.y, Math.max(3, this.data.brushSize * scale / 2), 0, Math.PI * 2);
        ctx.fill();
      }

      lastPoint = nextPoint;
    }

    await drawContext(ctx);
  },

  saveImage() {
    if (!this.data.resultImage) return;

    wx.saveImageToPhotosAlbum({
      filePath: this.data.resultImage,
      success: () => {
        wx.showToast({ title: '保存成功', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  shareImage() {
    if (!this.data.resultImage) return;

    wx.showShareImageMenu({
      imageUrl: this.data.resultImage
    });
  },

  updateStats() {
    const stats = getWatermarkStats();
    stats.imageErases += 1;
    setWatermarkStats(stats);
  }
});
