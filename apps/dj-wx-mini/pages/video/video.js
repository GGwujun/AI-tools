const storage = require('../../utils/safe-storage');
const { inferPlatformLabelFromUrl } = require('../../utils/parse-link');
const { parseVideo, inferFailureReason } = require('../../utils/parse-runner');

function formatDateTime(dateString) {
  if (!dateString) return '刚刚';
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}月${day}日 ${hour}:${minute}`;
}

function formatCacheLabel(cacheUntil) {
  if (!cacheUntil) return '本次会话';
  const diff = new Date(cacheUntil).getTime() - Date.now();
  if (diff <= 0) return '缓存已过期';

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.ceil((diff % 3600000) / 60000);
  return hours > 0 ? `约 ${hours}小时${minutes}分钟` : `约 ${minutes}分钟`;
}

function buildResultMeta(resultData) {
  const meta = resultData.meta || {};
  const sourceUrl = meta.sourceUrl || resultData.videourl || resultData.pics?.[0] || '';
  return {
    ...meta,
    sourceUrl,
    platformLabel: meta.platformLabel || inferPlatformLabelFromUrl(sourceUrl),
    typeLabel: meta.typeLabel || (resultData.downurl ? '无水印视频' : '无水印图集'),
    routeLabel: meta.routeLabel || '主线路',
    parsedAt: meta.parsedAt || new Date().toISOString(),
    cacheUntil: meta.cacheUntil || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    complianceNote: meta.complianceNote || '仅用于个人学习与备份，禁止商用侵权'
  };
}

function buildSummaryItems(resultData, meta) {
  return [
    { label: '平台来源', value: meta.platformLabel },
    { label: '内容类型', value: meta.typeLabel },
    { label: '解析线路', value: meta.routeLabel },
    { label: '解析时间', value: formatDateTime(meta.parsedAt) }
  ];
}

function buildResourceNotes(resultData, meta) {
  const notes = [
    `缓存有效期：${formatCacheLabel(meta.cacheUntil)}`,
    `合规说明：${meta.complianceNote}`
  ];

  if (resultData.downurl) {
    notes.unshift('当前结果包含无水印直链，并支持封面单独保存；保存失败时可复制来源链接做浏览器兜底');
  } else {
    notes.unshift(`当前结果包含 ${resultData.pics?.length || 0} 张高清原图，可单张保存、复制当前图链接或整组导出`);
  }

  return notes;
}

function buildProxyImageUrl(url) {
  return `https://dsx-family.site/api/download/image/?url=${encodeURIComponent(url)}`;
}

function getPreferredVideoDownloadUrl(resultData) {
  const durlList = resultData?.extra?.playurl?.durl || [];
  const directUrl = durlList[0]?.url;
  return directUrl || resultData?.downurl || '';
}

Page({
  data: {
    resultData: null,
    parseState: 'idle',
    parseMessage: '',
    failureReason: '',
    pendingInput: '',
    hasWatchedAd: false,
    adWatchedTimestamp: null,
    currentAction: null,
    adUnitId: '',
    isFavorite: false,
    resultMeta: null,
    summaryItems: [],
    resourceNotes: [],
    currentPicIndex: 0,
    downloadList: [
      'https://49-79-134-222.volcsiriusbd.com',
      'https://ali-ky.video.yximgs.com',
      'https://alimov2.a.kwimgs.com',
      'https://alimov2.a.yximgs.com',
      'https://apd-4af61a075495b237b2cebd02a8b452de.v.smtcdns.com',
      'https://apd-dab9ae12dbdc8420779f283f9f3d368b.v.smtcdns.com',
      'https://baikevideo.cdn.bcebos.com',
      'https://bd-video.izuiyou.com',
      'https://bdmov.a.yximgs.com',
      'https://bizsec-auth.alicdn.com',
      'https://ci.xiaohongshu.com',
      'https://cloud.video.taobao.com',
      'https://cn-ahwh-ct-01-02.bilivideo.com',
      'https://cn-sccd-ct-01-20.bilivideo.com',
      'https://cn-sccd-ct-01-22.bilivideo.com',
      'https://cn-scya-ct-01-04.bilivideo.com',
      'https://daren-auth.alicdn.com',
      'https://f.us.sinaimg.cn',
      'https://f.video.weibocdn.com',
      'https://fb.video.weibocdn.com',
      'https://fvdcdn.cp63.ott.cibntv.net',
      'https://guangguang.cloudvideocdn.taobao.com',
      'https://hwvideo.izuiyou.com',
      'https://img.alicdn.com',
      'https://jsmov2.a.yximgs.com',
      'https://jsmov3.a.yximgs.com',
      'https://jsy.izuiyou.com',
      'https://jvod.300hu.com',
      'https://live-segment.cloudvideocdn.taobao.com',
      'https://live.video.weibocdn.com',
      'https://love.srvv.cn',
      'https://m.video.weibocdn.com',
      'https://mpvideo.qpic.cn',
      'https://music.163.com',
      'https://o1.a.88cdn.com',
      'https://o3.a.88cdn.com',
      'https://p1.a.yximgs.com',
      'https://p2.a.yximgs.com',
      'https://p26-sign.douyinpic.com',
      'https://p3-sign.douyinpic.com',
      'https://p3.a.yximgs.com',
      'https://p4.a.yximgs.com',
      'https://p5.a.yximgs.com',
      'https://p9-sign.douyinpic.com',
      'https://p97-sign.douyinpic.com',
      'https://q.weishi.qq.com',
      'https://qsy.ludeqi.com',
      'https://shortv.cdp.qq.com',
      'https://sns-img-qc.xhscdn.com',
      'https://sns-video-hw.xhscdn.com',
      'https://store.xiaohongshu.com',
      'https://tb-video.bdstatic.com',
      'https://tbm-auth.alicdn.com',
      'https://tbvideo.ixiaochuan.cn',
      'https://tx-safety-video.acfun.cn',
      'https://tx.stream.kg.qq.com',
      'https://tx2.a.kwimgs.com',
      'https://txmov2.a.kwimgs.com',
      'https://txmov2.a.yximgs.com',
      'https://txzuiyou.izuiyou.com',
      'https://upmov.a.kwimgs.com',
      'https://upos-sz-mirror08c.bilivideo.com',
      'https://upos-sz-mirrorali.bilivideo.com',
      'https://upos-sz-mirrorcos.bilivideo.com',
      'https://upos-sz-mirrorhw.bilivideo.com',
      'https://v.weishi.qq.com',
      'https://v.xiaohongshu.com',
      'https://v1-cold.douyinvod.com',
      'https://v1.douyinvod.com',
      'https://v11-cold.douyinvod.com',
      'https://v11-x.douyinvod.com',
      'https://v11.douyinvod.com',
      'https://v13-b.douyinvod.com',
      'https://v26-cdn-tos.ppxvod.com',
      'https://v26-cold.douyinvod.com',
      'https://v26-default.365yg.com',
      'https://v26-default.ixigua.com',
      'https://v26-jianying.vlabvod.com',
      'https://v26-web.douyinvod.com',
      'https://v26.douyinvod.com',
      'https://v26.huoshanvod.com',
      'https://v27-cold.douyinvod.com',
      'https://v27.douyinvod.com',
      'https://v3-a.huoshanvod.com',
      'https://v3-b.douyinvod.com',
      'https://v3-c.douyinvod.com',
      'https://v3-d.douyinvod.com',
      'https://v3-default.ixigua.com',
      'https://v3-jianying.vlabvod.com',
      'https://v3-web.douyinvod.com',
      'https://v3-xg-web-pc.ixigua.com',
      'https://v3.douyinvod.com',
      'https://v5-cold.douyinvod.com',
      'https://v5-colda.douyinvod.com',
      'https://v5-colde.douyinvod.com',
      'https://v5-coldf.douyinvod.com',
      'https://v5-coldg.douyinvod.com',
      'https://v5-coldh.douyinvod.com',
      'https://v5-coldj.douyinvod.com',
      'https://v5-coldp.douyinvod.com',
      'https://v5-coldy.douyinvod.com',
      'https://v5-j.douyinvod.com',
      'https://v5-re-un803.douyinvod.com',
      'https://v5.douyinvod.com',
      'https://v6-cold-nxyd.douyinvod.com',
      'https://v6-default.ixigua.com',
      'https://v6-jianying.vlabvod.com',
      'https://v6-x.douyinvod.com',
      'https://v6.douyinvod.com',
      'https://v83-017.douyinvod.com',
      'https://v9-cold.douyinvod.com',
      'https://v9-cold1.douyinvod.com',
      'https://v9-default.ixigua.com',
      'https://v9-jianying.vlabvod.com',
      'https://v9-z.douyinvod.com',
      'https://v9.douyinvod.com',
      'https://v9.huoshanvod.com',
      'https://v95.douyinvod.com',
      'https://v99.douyinvod.com',
      'https://vali-ugc.cp31.ott.cibntv.net',
      'https://vali01.cp31.ott.cibntv.net',
      'https://vd2.bdstatic.com',
      'https://vd3.bdstatic.com',
      'https://vd4.bdstatic.com',
      'https://vdse.bdstatic.com',
      'https://video-extract.qingdou.vip',
      'https://video.dispatch.tc.qq.com',
      'https://video.izuiyou.com',
      'https://video4.pddpic.com',
      'https://videocdn.poizon.com',
      'https://xianyu-video.alicdn.com',
      'https://xx1.video.xiuxiustatic.com',
      'https://v93.douyinvod.com',
      'https://v5-che.douyinvod.com',
      'https://v6-qos-hourly.douyinvod.com',
      'https://v26-che.douyinvod.com',
      'https://v6-cold.douyinvod.com',
      'https://v83-x.douyinvod.com',
      'https://v5-coldb.douyinvod.com',
      'https://v3-z.douyinvod.com',
      'https://v1-x.douyinvod.com',
      'https://v6-ab-e1.douyinvod.com',
      'https://v5-abtest.douyinvod.com',
      'https://v9-che.douyinvod.com',
      'https://v83-y.douyinvod.com',
      'https://v5-litea.douyinvod.com',
      'https://v3-che.douyinvod.com',
      'https://v29-cold.douyinvod.com',
      'https://v5-lite.douyinvod.com',
      'https://v29-qos-control.douyinvod.com',
      'https://v5-gdgz.douyinvod.com',
      'https://v5-ttcp-a.douyinvod.com',
      'https://v3-b.douyinvod.com',
      'https://v9-z-qos-control.douyinvod.com',
      'https://v9-x-qos-hourly.douyinvod.com',
      'https://v9-chc.douyinvod.com',
      'https://v9-qos-hourly.douyinvod.com',
      'https://v5-ttcp-b.douyinvod.com',
      'https://v6-z-qos-control.douyinvod.com',
      'https://v5-dlyd.douyinvod.com',
      'https://v5-coldy.douyinvod.com',
      'https://v3-c.douyinvod.com',
      'https://v5-jbwl.douyinvod.com',
      'https://v26-0015c002.douyinvod.com',
      'https://v5-gdwy.douyinvod.com',
      'https://v3-d.douyinvod.com',
      'https://v3-p.douyinvod.com',
      'https://v5-gdhy.douyinvod.com',
      'https://v26-cold.douyinvod.com',
      'https://v5-lite-a.douyinvod.com',
      'https://v5-i.douyinvod.com',
      'https://v5-g.douyinvod.com',
      'https://v26-qos-daily.douyinvod.com',
      'https://v16m-default.tiktokcdn.com'
    ], // 你的小程序合法 download 列表
  },

  onLoad: function (options) {
    const hasWatchedAd = storage.get('hasWatchedAd');
    const adWatchedTimestamp = storage.get('adWatchedTimestamp');

    this.setData({
      hasWatchedAd: !!hasWatchedAd,
      adWatchedTimestamp: adWatchedTimestamp || null,
      currentPicIndex: 0
    });

    // 拉取广告配置
    wx.request({
      url: 'https://dsx-family.site/ymq/',
      method: 'GET',
      success: (res) => {
        const config = res.data?.data;
        if (config?.adUnitId) {
          this.setData({ adUnitId: config.adUnitId });
        }
      },
      fail: () => {}
    });

    if (options.data) {
      // 直接传入结果数据（历史/收藏回看）
      try {
        const resultData = JSON.parse(decodeURIComponent(options.data));
        this.applyResultData(resultData);
      } catch (error) {
        console.error('解析结果数据失败:', error);
      }
      return;
    }

    if (options.input) {
      // 从首页带来输入，进页面后自动解析
      let input = '';
      try {
        input = decodeURIComponent(options.input);
      } catch (error) {
        console.error('读取输入失败:', error);
      }
      if (input) {
        this.runParse(input);
      }
    }
  },

  runParse(input) {
    this.setData({
      parseState: 'loading',
      parseMessage: '正在解析...',
      failureReason: '',
      resultData: null,
      pendingInput: input
    });

    parseVideo(input)
      .then((resultData) => {
        this.applyResultData(resultData);
        this.setData({ parseState: 'success', parseMessage: '解析完成' });
      })
      .catch((error) => {
        const failureReason = inferFailureReason(error);
        this.setData({
          parseState: 'failed',
          parseMessage: '解析未完成',
          failureReason
        });
      });
  },

  retryParse() {
    if (this.data.pendingInput) {
      this.runParse(this.data.pendingInput);
    }
  },

  applyResultData(resultData) {
    this.setData({ resultData, currentPicIndex: 0 });
    this.prepareResultState(resultData);
    this.saveToHistory(resultData);
    this.checkFavoriteStatus(resultData);
  },

  confirmAdWatch: function (e) {
    const action = e.currentTarget.dataset.action;
    const currentTime = new Date().getTime();
    const twelveHours = 12 * 60 * 60 * 1000;

    // 如果 adUnitId 存在
    if (this.data.adUnitId) {
      // 检查是否在冷却时间内
      const lastWatchedTime = this.data.adWatchedTimestamp;
      if (this.data.hasWatchedAd && lastWatchedTime && (currentTime - lastWatchedTime) < twelveHours) {
        // 如果已经看过广告并且在冷却时间内，直接执行操作
        this.setData({
          currentAction: action
        });
        this.handleAction();
      } else {
        // 需要观看广告，弹出提示框
        wx.showModal({
          title: '提示',
          content: '需观看一段广告，即可获取资源',
          success: (res) => {
            if (res.confirm) {
              this.setData({
                currentAction: action
              });
              this.watchAd(() => {
                this.handleAction();
              });
            }
          }
        });
      }
    } else {
      // 如果 adUnitId 不存在，直接执行操作
      this.setData({
        currentAction: action
      });
      this.handleAction();
    }
  },

  handleAction: function () {
    switch (this.data.currentAction) {
      case 'copyTitle':
        this.onCopyTitle();
        break;
      case 'copySource':
        this.onCopySource();
        break;
      case 'copyLink':
        this.onCopyLink();
        break;
      case 'downloadVideo':
        this.onDownloadVideo();
        break;
      case 'downloadCover':
        this.onDownloadCover();
        break;
      case 'copyCurrentPic':
        this.onCopyCurrentPic();
        break;
      case 'downloadCurrentPic':
        this.onDownloadCurrentPic();
        break;
      case 'downloadAllPics':
        this.onDownloadAllPics();
        break;
      default:
        break;
    }
  },

  prepareResultState(resultData) {
    const resultMeta = buildResultMeta(resultData);
    this.setData({
      currentPicIndex: 0,
      resultMeta,
      summaryItems: buildSummaryItems(resultData, resultMeta),
      resourceNotes: buildResourceNotes(resultData, resultMeta)
    });
  },

  watchAd: function (callback) {
    wx.showLoading({
      title: '加载广告中...'
    });

    var log = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null
    log?.info?.apply(log, ['开始加载广告,广告id：', this.data.adUnitId])

    if (!wx.createRewardedVideoAd) {
      log?.info?.apply(log, ['广告组件不支持，跳过广告开始解析视频。广告id：', this.data.adUnitId])
      callback();
      return;
    }
    const videoAd = wx.createRewardedVideoAd({
      adUnitId: this.data.adUnitId // 使用从请求得到的广告单元 ID
    });

    videoAd.onLoad(() => {
      log?.info?.apply(log, ['广告加载完毕。广告id：', this.data.adUnitId])
    })

    videoAd.onError((err) => {
      wx.hideLoading();
      log?.error?.apply(log, ['激励视频光告加载失败。广告id：', this.data.adUnitId, err])
      wx.showToast({
        title: '广告拉取失败，请稍后重试',
        icon: 'none'
      });
    })

    videoAd.show()
      .then(() => {
        wx.hideLoading();
        log?.info?.apply(log, ['加载广告完毕，开始显示广告视频'])
      })
      .catch(err => {
        log?.error.apply(log, ['加载广告失败,失败重试', this.data.adUnitId, err])
        // 失败重试
        videoAd.load()
          .then(() => {
            wx.hideLoading();
            log?.info?.apply(log, ['重试拉取广告成功'])
            videoAd.show()
          })
          .catch(err => {
            wx.hideLoading();
            log?.error?.apply(log, ['重试拉取广告失败', err])
            console.error('激励视频 广告显示失败', err);
            wx.showToast({
              title: '广告加载失败，请稍后重试',
              icon: 'none'
            });
          })
      });

    videoAd.onClose((status) => {
      if (status && status.isEnded) {
        const currentTime = new Date().getTime();
        log?.info.apply(log, ['广告观看完毕，开始解析视频', status, currentTime])
        storage.set('hasWatchedAd', true);
        storage.set('adWatchedTimestamp', currentTime);
        this.setData({
          hasWatchedAd: true,
          adWatchedTimestamp: currentTime
        });
        callback();
      } else {
        wx.showToast({
          title: '观看完整广告才能继续操作',
          icon: 'none'
        });
      }
    });
  },

  onCopyLink: function () {
    wx.setClipboardData({
      data: this.data.resultData.downurl,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });
  },

  onCopySource: function () {
    const sourceUrl = this.data.resultMeta?.sourceUrl || this.data.resultData?.videourl || '';
    if (!sourceUrl) return;

    wx.setClipboardData({
      data: sourceUrl,
      success: () => {
        wx.showToast({
          title: '来源链接已复制',
          icon: 'success'
        });
      }
    });
  },

  onCopyTitle: function () {
    wx.setClipboardData({
      data: this.data.resultData.title,
      success: () => {
        wx.showToast({
          title: '标题已复制',
          icon: 'success'
        });
      }
    });
  },

  getCurrentPicUrl() {
    const pics = this.data.resultData?.pics || [];
    return pics[this.data.currentPicIndex] || pics[0] || '';
  },

  saveImageByUrl(url, successTitle = '保存成功') {
    if (!url) {
      wx.showToast({ title: '当前没有可保存图片', icon: 'none' });
      return;
    }

    if (/^(wxfile|http:\/\/tmp\/|https:\/\/tmp\/|file:)/i.test(url) || /^[A-Za-z]:\\/.test(url)) {
      wx.saveImageToPhotosAlbum({
        filePath: url,
        success: () => {
          wx.showToast({ title: successTitle, icon: 'success' });
        },
        fail: () => {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      });
      return;
    }

    wx.showLoading({
      title: '准备保存...'
    });

    wx.downloadFile({
      url: buildProxyImageUrl(url),
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.hideLoading();
          wx.showToast({ title: '下载图片失败', icon: 'none' });
          return;
        }

        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: successTitle, icon: 'success' });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载图片失败', icon: 'none' });
      }
    });
  },

  openDocExtract() {
    const title = this.data.resultData?.title || '';
    const body = this.data.resultMeta?.sourceUrl || this.data.resultData?.videourl || '';
    const tags = [
      this.data.resultMeta?.platformLabel,
      this.data.resultMeta?.typeLabel,
      this.data.resultMeta?.routeLabel
    ].filter(Boolean).map((item) => `#${item}`).join(' ');

    wx.navigateTo({
      url: `/pages/doc-extract/doc-extract?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&tags=${encodeURIComponent(tags)}`
    });
  },

  onPreviewCover() {
    const coverUrl = this.data.resultData?.photo || '';
    if (!coverUrl) return;

    wx.previewImage({
      current: coverUrl,
      urls: [coverUrl]
    });
  },

  onDownloadCover() {
    this.saveImageByUrl(this.data.resultData?.photo || '', '封面已保存');
  },

  onGalleryChange(e) {
    this.setData({
      currentPicIndex: Number(e.detail.current || 0)
    });
  },

  onPreviewCurrentPic() {
    const pics = this.data.resultData?.pics || [];
    const current = this.getCurrentPicUrl();
    if (!pics.length || !current) return;

    wx.previewImage({
      current,
      urls: pics
    });
  },

  onCopyCurrentPic() {
    const current = this.getCurrentPicUrl();
    if (!current) {
      wx.showToast({ title: '当前没有图片链接', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: current,
      success: () => {
        wx.showToast({ title: '当前图片链接已复制', icon: 'success' });
      }
    });
  },

  onDownloadCurrentPic() {
    const current = this.getCurrentPicUrl();
    this.saveImageByUrl(current, '当前图片已保存');
  },

  isUrlInDownloadList(url) {
    return this.data.downloadList.some(validUrl => url.includes(validUrl));
  },

  isDirectMediaUrl(url) {
    const value = String(url || '').toLowerCase();
    return /\.mp4(\?|$)/.test(value)
      || /\.m3u8(\?|$)/.test(value)
      || /xhscdn\.com\/.*mp4/.test(value);
  },

  onDownloadVideo: function () {
    let url = this.data.resultData.videourl;
    let downurl = getPreferredVideoDownloadUrl(this.data.resultData);
    const isInDownloadList = this.isUrlInDownloadList(downurl);
    const isDirectMedia = this.isDirectMediaUrl(downurl);
    if (isInDownloadList || isDirectMedia) {
      // 直接下载
      this.startVideoDownload(downurl);
    } else {
      // 先提示用户正在计算视频大小
      wx.showLoading({
        title: '计算视频大小...',
      });
      console.log("正在获取视频大小");
      const apiUrl = `https://dsx-family.site/api/get_video_size/?url=${encodeURIComponent(downurl)}`;
      wx.request({
        url: apiUrl,
        method: 'GET', // 使用 GET 请求获取文件大小
        success: (res) => {
          // 先隐藏提示框
          wx.hideLoading();

          if (res.data.error) {
            wx.showToast({
              title: '获取视频大小失败',
              icon: 'none'
            });
            return;
          }

          const videoSize = parseInt(res.data.content_length, 10); // 获取文件大小
          console.log(videoSize, '视频大小');

          if (videoSize > 100 * 1024 * 1024) {
            wx.setClipboardData({
              data: downurl || url,
              success: () => {
                wx.showToast({
                  title: '视频超过100MB，请使用浏览器下载',
                  icon: 'none'
                });
              }
            });
          } else {
            const downloadTarget = downurl || url;
            const downloadUrl = this.isDirectMediaUrl(downloadTarget)
              ? downloadTarget
              : `http://127.0.0.1:8091/api/download?url=${encodeURIComponent(downloadTarget)}&prefix=true&with_watermark=false`;
            this.startVideoDownload(downloadUrl);
          }
        },
        fail: (err) => {
          wx.hideLoading(); // 确保在失败时也隐藏提示框
          wx.showToast({
            title: '获取视频大小失败',
            icon: 'none'
          });
          console.error('获取视频大小失败:', err);
        }
      });
    }
  },

  startVideoDownload: function (url) {
    wx.showLoading({
      title: '准备下载...',
    });

    var log = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null


    const downloadTask = wx.downloadFile({
      url: url,
      success: (res) => {
        wx.hideLoading(); // 确保成功时隐藏加载动画

        if (res.statusCode === 200) {
          log?.info?.apply(log, ['视频下载成功', res, url])
          saveVideo(res.tempFilePath);
        } else {
          wx.showToast({
            title: '视频下载失败',
            icon: 'none'
          });
          log?.error?.apply(log, ['视频下载失败', res, url])
        }
      },
      fail: (err) => {
        wx.hideLoading(); // 在失败时也确保隐藏加载动画
        wx.showToast({
          title: '下载失败，请点击左侧复制链接打开浏览器下载',
          icon: 'none'
        });
        log?.error?.apply(log, ['视频下载失败，错误信息:', err])
        log?.error?.apply(log, ['视频下载失败,下载失败的 URL:', url])
      }
    });

    downloadTask.onProgressUpdate((res) => {
      if (res.progress === 100) {
        wx.hideLoading(); // 下载完成时关闭加载提示
      } else {
        wx.showLoading({
          title: `下载进度: ${res.progress}%`,
        });
      }
    });

    function saveVideo(filePath) {
      wx.getSetting({
        success(res) {
          if (res.authSetting['scope.writePhotosAlbum']) {
            // 用户已经授权访问相册
            console.log('用户已授权访问相册');
            log?.info?.apply(log, ['用户已授权访问相册', res.authSetting])
            wx.saveVideoToPhotosAlbum({
              filePath: filePath,
              success: () => {
                wx.showToast({
                  title: '视频保存成功',
                  icon: 'success'
                });
                log?.info?.apply(log, ['用户已授权访问相册,保存到相册成功', filePath])
              },
              fail: (err) => {
                wx.showToast({
                  title: '保存到相册失败',
                  icon: 'none',
                  content: err,
                });
                log?.error?.apply(log, ['保存到相册失败', err, filePath])
              }
            });
          } else {
            // 用户没有授权访问相册
            console.log('用户未授权访问相册');
            log?.info?.apply(log, ['用户未授权访问相册，准备开始让用户授权'])
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success() {
                console.log('用户已授权访问相册');
                log?.info?.apply(log, ['用户已授权访问相册'])

                // 继续执行保存视频到相册的操作
                wx.saveVideoToPhotosAlbum({
                  filePath: filePath,
                  success: () => {
                    wx.showToast({
                      title: '视频保存成功',
                      icon: 'success'
                    });
                    log?.info?.apply(log, ['用户已授权访问相册，视频保存成功', filePath])
                  },
                  fail: (err) => {
                    wx.showToast({
                      title: '保存到相册失败',
                      icon: 'none',
                      content: err,
                    });
                    log?.error?.apply(log, ['用户已授权访问相册,保存到相册失败', err])
                  }
                });
              },
              fail(err) {
                console.log('用户拒绝授权访问相册');
                log?.error?.apply(log, ['用户拒绝授权访问相册', err])
                // 提示用户手动授权
                wx.showModal({
                  title: '授权提示',
                  content: '我们需要您授权访问相册，以便保存视频到相册。',
                  success(res) {
                    if (res.confirm) {
                      // 跳转到设置页让用户手动开启授权
                      wx.openSetting({
                        success(settingRes) {
                          if (settingRes.authSetting['scope.writePhotosAlbum']) {
                            console.log('用户已授权');
                            wx.saveVideoToPhotosAlbum({
                              filePath: filePath,
                              success: () => {
                                wx.showToast({
                                  title: '视频保存成功',
                                  icon: 'success'
                                });
                                log?.info?.apply(log, ['跳转到设置页让用户手动开启授权,用户已授权,视频保存成功'])
                              },
                              fail: (err) => {
                                wx.showToast({
                                  title: '保存到相册失败',
                                  icon: 'none',
                                  content: err,
                                });
                                log?.info?.apply(log, ['跳转到设置页让用户手动开启授权,用户已授权,保存到相册失败', err])
                              }
                            });
                          } else {
                            console.log('用户仍未授权');
                            log?.error?.apply(log, ['跳转到设置页让用户手动开启授权,用户仍未授权'])
                          }
                        }
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
  },

  onDownloadAllPics: function () {
    var log = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null
    const pics = this.data.resultData.pics;
    if (!pics || pics.length === 0) {
      wx.showToast({
        title: '没有图片可下载',
        icon: 'none'
      });
      log?.info.apply(log, ['没有图片可下载', pics])
      return;
    }

    wx.showLoading({
      title: '准备下载...',
    });

    const totalPics = pics.length;
    let downloadedPics = 0;

    const downloadPic = (index) => {
      if (index >= totalPics) {
        wx.hideLoading(); // 所有下载完成后隐藏加载动画
        wx.showToast({
          title: '所有图片下载完成',
          icon: 'success'
        });
        log?.info.apply(log, ['所有图片下载完成', pics])
        return;
      }

      const url = `https://dsx-family.site/api/download/image/?url=${encodeURIComponent(pics[index])}`;
      wx.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                downloadedPics++;
                wx.showLoading({
                  title: `下载进度: ${Math.round((downloadedPics / totalPics) * 100)}%`,
                });
                downloadPic(index + 1);
              },
              fail: (error) => {
                wx.showToast({
                  title: `图片 ${index + 1} 保存失败`,
                  icon: 'none'
                });
                log?.error.apply(log, [`图片 ${index + 1} 保存失败`, error])
                downloadPic(index + 1);
              }
            });
          } else {
            wx.showToast({
              title: `图片 ${index + 1} 下载失败`,
              icon: 'none'
            });
            log?.error.apply(log, [`图片 ${index + 1} 下载失败`])
            downloadPic(index + 1);
          }
        },
        fail: (err) => {
          wx.showToast({
            title: `图片 ${index + 1} 下载失败`,
            icon: 'none'
          });
          log?.error.apply(log, [`图片 ${index + 1} 下载失败`, err])
          downloadPic(index + 1);
        }
      });
    };

    downloadPic(0);
  },

  // 保存到历史记录
  saveToHistory: function (resultData) {
    try {
      let history = storage.get('parseHistory', []);
      
      // 创建历史记录项
      const historyItem = {
        id: Date.now().toString(),
        title: resultData.title || '未命名',
        cover: resultData.photo || '',
        type: resultData.downurl ? 'video' : 'image',
        url: resultData.videourl || resultData.pics?.[0] || '',
        downurl: resultData.downurl || '',
        pics: resultData.pics || [],
        meta: buildResultMeta(resultData),
        createdAt: new Date().toISOString(),
        favorited: false
      };

      // 检查是否已存在相同URL的记录
      const existingIndex = history.findIndex(item => item.url === historyItem.url);
      if (existingIndex !== -1) {
        // 更新现有记录的时间
        history[existingIndex].createdAt = historyItem.createdAt;
        history[existingIndex].title = historyItem.title;
        history[existingIndex].cover = historyItem.cover;
        history[existingIndex].meta = historyItem.meta;
      } else {
        // 添加到开头
        history.unshift(historyItem);
      }

      // 限制最多30条记录
      if (history.length > 30) {
        history = history.slice(0, 30);
      }

      storage.set('parseHistory', history);
    } catch (e) {
      console.error('保存历史记录失败:', e);
    }
  },

  // 检查收藏状态
  checkFavoriteStatus: function (resultData) {
    try {
      const favorites = storage.get('favorites', []);
      const isFavorite = favorites.some(item => item.url === (resultData.videourl || resultData.pics?.[0]));
      this.setData({ isFavorite });
    } catch (e) {
      console.error('检查收藏状态失败:', e);
    }
  },

  // 切换收藏状态
  toggleFavorite: function () {
    const resultData = this.data.resultData;
    if (!resultData) return;

    try {
      let favorites = storage.get('favorites', []);
      const url = resultData.videourl || resultData.pics?.[0];
      const existingIndex = favorites.findIndex(item => item.url === url);

      if (existingIndex !== -1) {
        // 取消收藏
        favorites.splice(existingIndex, 1);
        this.setData({ isFavorite: false });
        wx.showToast({ title: '已取消收藏', icon: 'none' });
      } else {
        // 添加收藏
        favorites.unshift({
          id: Date.now().toString(),
          title: resultData.title || '未命名',
          cover: resultData.photo || '',
          type: resultData.downurl ? 'video' : 'image',
          url: url,
          downurl: resultData.downurl || '',
          pics: resultData.pics || [],
          meta: buildResultMeta(resultData),
          createdAt: new Date().toISOString()
        });
        this.setData({ isFavorite: true });
        wx.showToast({ title: '已收藏', icon: 'success' });
      }

      storage.set('favorites', favorites);
    } catch (e) {
      console.error('切换收藏失败:', e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 跳转到历史记录页面
  goToHistory: function () {
    wx.switchTab({
      url: '/pages/kj/kj'
    });
  },

  goHome() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  }
});
