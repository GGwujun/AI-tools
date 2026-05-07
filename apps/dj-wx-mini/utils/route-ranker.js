const storage = require('./safe-storage');

const ROUTE_STATS_KEY = 'parseRouteStats';

function readStats() {
  const value = storage.get(ROUTE_STATS_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

function writeStats(stats) {
  storage.set(ROUTE_STATS_KEY, stats);
}

function getRouteStats() {
  return readStats();
}

function getRouteStat(routeId) {
  return readStats()[routeId] || {
    routeId,
    successCount: 0,
    failureCount: 0,
    lastSuccessAt: '',
    lastFailureAt: '',
    lastStatus: ''
  };
}

function getRecencyBonus(stat) {
  if (!stat.lastSuccessAt) return 0;

  const diff = Date.now() - new Date(stat.lastSuccessAt).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff <= oneDay) return 10;
  if (diff <= oneDay * 3) return 6;
  if (diff <= oneDay * 7) return 3;
  return 0;
}

function getRouteScore(stat) {
  const successCount = stat.successCount || 0;
  const failureCount = stat.failureCount || 0;
  const total = successCount + failureCount;
  const successRate = total ? successCount / total : 0;

  return Math.round(
    successCount * 12
    - failureCount * 7
    + successRate * 36
    + getRecencyBonus(stat)
  );
}

function formatRouteHint(stat) {
  const successCount = stat.successCount || 0;
  const failureCount = stat.failureCount || 0;
  const total = successCount + failureCount;

  if (!total) {
    return '尚无历史表现';
  }

  const successRate = Math.round((successCount / total) * 100);
  const statusText = stat.lastStatus === 'success' ? '最近成功' : '最近失败';
  return `命中率 ${successRate}% · ${statusText}`;
}

function rankRouteOptions(routeOptions) {
  return routeOptions
    .map((route) => {
      const stat = getRouteStat(route.id);
      const successCount = stat.successCount || 0;
      const failureCount = stat.failureCount || 0;
      const total = successCount + failureCount;
      const successRate = total ? Math.round((successCount / total) * 100) : 0;

      return {
        ...route,
        score: getRouteScore(stat),
        successCount,
        failureCount,
        successRate,
        statsHint: formatRouteHint(stat),
        statsBadge: total ? `${successRate}%` : '新线',
        lastStatus: stat.lastStatus || ''
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.successCount !== left.successCount) {
        return right.successCount - left.successCount;
      }

      return left.label.localeCompare(right.label, 'zh-Hans-CN');
    })
    .map((route, index) => ({
      ...route,
      recommended: index === 0
    }));
}

function recordRouteResult(route, status) {
  if (!route?.id || !status) return null;

  const stats = readStats();
  const current = stats[route.id] || {
    routeId: route.id,
    routeLabel: route.label || route.id,
    successCount: 0,
    failureCount: 0,
    lastSuccessAt: '',
    lastFailureAt: '',
    lastStatus: ''
  };
  const now = new Date().toISOString();

  if (status === 'success') {
    current.successCount += 1;
    current.lastSuccessAt = now;
  } else if (status === 'failed') {
    current.failureCount += 1;
    current.lastFailureAt = now;
  }

  current.routeLabel = route.label || current.routeLabel;
  current.lastStatus = status;
  stats[route.id] = current;
  writeStats(stats);
  return current;
}

module.exports = {
  getRouteStats,
  getRouteStat,
  getRouteScore,
  rankRouteOptions,
  recordRouteResult
};
