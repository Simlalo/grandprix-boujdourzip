// src/lib/offlineQueue.js
// نظام صف انتظار محلي للبيانات الحساسة (خط الوصول، الميقاتي)
// يضمن عدم فقدان البيانات عند انقطاع الإنترنت

const DB_NAME = 'grandprix_offline';
const DB_VERSION = 1;

/**
 * يفتح اتصالاً بقاعدة البيانات المحلية ويُنشئ المخازن إن لم تكن موجودة.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // مخزن صدريات خط الوصول
      if (!db.objectStoreNames.contains('finish_orders')) {
        const store = db.createObjectStore('finish_orders', { keyPath: 'client_id' });
        store.createIndex('race_id', 'race_id', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // مخزن تواقيت الميقاتي
      if (!db.objectStoreNames.contains('timings')) {
        const store = db.createObjectStore('timings', { keyPath: 'client_id' });
        store.createIndex('race_id', 'race_id', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

/**
 * يولّد معرّفاً فريداً لكل إدخال محلي.
 */
export function generateClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * يضيف سجلاً جديداً إلى المخزن المحلي.
 * @param {string} storeName  'finish_orders' | 'timings'
 * @param {object} record     السجل
 */
export async function enqueue(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put({ ...record, synced: record.synced ? 1 : 0 });
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

/**
 * يجلب كل سجلات سباق محدد من المخزن المحلي.
 */
export async function getAllForRace(storeName, raceId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index('race_id');
    const request = index.getAll(raceId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * يجلب السجلات غير المتزامنة من المخزن.
 */
export async function getPending(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index('synced');
    const request = index.getAll(0);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * يضع علامة مزامنة على سجل.
 */
export async function markSynced(storeName, clientId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const getReq = store.get(clientId);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        resolve(null);
        return;
      }
      record.synced = 1;
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * يحذف سجلاً (للتراجع عن آخر إدخال).
 */
export async function deleteRecord(storeName, clientId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(clientId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * يمسح كل سجلات سباق (مفيد بعد اعتماد اللجنة).
 */
export async function clearRace(storeName, raceId) {
  const records = await getAllForRace(storeName, raceId);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach((r) => store.delete(r.client_id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}