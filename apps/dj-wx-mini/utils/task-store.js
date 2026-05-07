const storage = require('./safe-storage');
const PARSE_TASKS_KEY = 'parseTasks';
const PARSE_TASK_RESULTS_KEY = 'parseTaskResults';
const MAX_TASK_RESULTS = 20;

function readList(key) {
  const value = storage.get(key, []);
  return Array.isArray(value) ? value : [];
}

function writeList(key, list) {
  storage.set(key, list);
}

function buildId(prefix = 'task') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getParseTasks() {
  return readList(PARSE_TASKS_KEY);
}

function getParseTaskResults() {
  return readList(PARSE_TASK_RESULTS_KEY);
}

function saveParseTask(task) {
  const now = new Date().toISOString();
  const currentTasks = getParseTasks();
  const normalizedTask = {
    id: task.id || buildId('parse'),
    status: task.status || 'pending',
    createdAt: task.createdAt || now,
    updatedAt: now,
    ...task
  };

  const nextTasks = currentTasks.filter((item) => item.id !== normalizedTask.id);
  nextTasks.unshift(normalizedTask);
  writeList(PARSE_TASKS_KEY, nextTasks.slice(0, 50));
  return normalizedTask;
}

function removeParseTask(id) {
  const nextTasks = getParseTasks().filter((item) => item.id !== id);
  writeList(PARSE_TASKS_KEY, nextTasks);
  removeParseTaskResult(id);
}

function saveParseTaskResult(taskId, resultData) {
  if (!taskId || !resultData) return null;

  const currentResults = getParseTaskResults();
  const nextRecord = {
    taskId,
    savedAt: new Date().toISOString(),
    resultData
  };

  const nextResults = currentResults.filter((item) => item.taskId !== taskId);
  nextResults.unshift(nextRecord);
  writeList(PARSE_TASK_RESULTS_KEY, nextResults.slice(0, MAX_TASK_RESULTS));
  return nextRecord;
}

function getParseTaskResult(taskId) {
  return getParseTaskResults().find((item) => item.taskId === taskId)?.resultData || null;
}

function removeParseTaskResult(taskId) {
  const nextResults = getParseTaskResults().filter((item) => item.taskId !== taskId);
  writeList(PARSE_TASK_RESULTS_KEY, nextResults);
}

function clearParseTasks() {
  writeList(PARSE_TASKS_KEY, []);
  writeList(PARSE_TASK_RESULTS_KEY, []);
}

module.exports = {
  getParseTasks,
  saveParseTask,
  removeParseTask,
  saveParseTaskResult,
  getParseTaskResult,
  clearParseTasks,
  buildId
};
