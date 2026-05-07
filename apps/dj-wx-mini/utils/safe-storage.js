const memoryStore = Object.create(null);

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

function logStorageWarning(action, key, error) {
  console.warn(`[safe-storage] ${action} failed for key "${key}"`, error);
}

function get(key, fallback = null) {
  try {
    const value = wx.getStorageSync(key);
    if (value === '' || value === undefined) {
      return key in memoryStore ? cloneValue(memoryStore[key]) : fallback;
    }
    return value;
  } catch (error) {
    logStorageWarning('getStorageSync', key, error);
    return key in memoryStore ? cloneValue(memoryStore[key]) : fallback;
  }
}

function set(key, value) {
  memoryStore[key] = cloneValue(value);
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (error) {
    logStorageWarning('setStorageSync', key, error);
    return false;
  }
}

function remove(key) {
  delete memoryStore[key];
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (error) {
    logStorageWarning('removeStorageSync', key, error);
    return false;
  }
}

module.exports = {
  get,
  set,
  remove
};
