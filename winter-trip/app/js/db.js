// IndexedDB: всё личное хранится только на телефоне.
//   kv       — план (base), локальные правки (overlay), отметки, настройки
//   docmeta  — описание файлов (имя, папка, привязки)
//   docdata  — сами файлы (ArrayBuffer — надёжнее Blob в старых Safari)

const DB_NAME = 'winter-trip';
const VERSION = 1;
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('docmeta')) db.createObjectStore('docmeta', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('docdata')) db.createObjectStore('docdata');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        let result;
        const r = fn(t.objectStore(store));
        if (r && 'onsuccess' in r) r.onsuccess = () => (result = r.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('Транзакция прервана'));
      })
  );
}

export const kvGet = (key) => tx('kv', 'readonly', (s) => s.get(key));
export const kvSet = (key, val) => tx('kv', 'readwrite', (s) => s.put(val, key));
export const kvDel = (key) => tx('kv', 'readwrite', (s) => s.delete(key));

export const docList = () => tx('docmeta', 'readonly', (s) => s.getAll());
export const docMetaGet = (id) => tx('docmeta', 'readonly', (s) => s.get(id));
export const docMetaPut = (meta) => tx('docmeta', 'readwrite', (s) => s.put(meta));
export async function docPut(meta, arrayBuffer) {
  await tx('docdata', 'readwrite', (s) => s.put(arrayBuffer, meta.id));
  await docMetaPut(meta);
}
export const docData = (id) => tx('docdata', 'readonly', (s) => s.get(id));
export async function docBlob(id) {
  const [meta, data] = await Promise.all([docMetaGet(id), docData(id)]);
  if (!meta || !data) return null;
  return new Blob([data], { type: meta.type || 'application/octet-stream' });
}
export async function docDelete(id) {
  await tx('docdata', 'readwrite', (s) => s.delete(id));
  await tx('docmeta', 'readwrite', (s) => s.delete(id));
}
export async function docClearAll() {
  await tx('docdata', 'readwrite', (s) => s.clear());
  await tx('docmeta', 'readwrite', (s) => s.clear());
}
