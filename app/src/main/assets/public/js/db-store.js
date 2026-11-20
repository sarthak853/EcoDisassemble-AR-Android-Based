export class DBStore {
  constructor() {
    this.dbName = 'EcoDisassembleDB';
    this.dbVersion = 1;
    this.db = null;
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        this.db = e.target.result;
        if (!this.db.objectStoreNames.contains('DiagnosticsHistory')) {
          const store = this.db.createObjectStore('DiagnosticsHistory', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e);
    });
  }
  
  async saveSession(data) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('DiagnosticsHistory', 'readwrite');
      const store = tx.objectStore('DiagnosticsHistory');
      const record = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        synced: false,
        ...data
      };
      store.add(record);
      tx.oncomplete = () => resolve(record.id);
      tx.onerror = (e) => reject(e);
    });
  }
  
  async getUnsynced() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('DiagnosticsHistory', 'readonly');
      const store = tx.objectStore('DiagnosticsHistory');
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result.filter(r => !r.synced));
      };
      request.onerror = (e) => reject(e);
    });
  }
  
  async markSynced(ids) {
    if (!this.db) await this.init();
    const tx = this.db.transaction('DiagnosticsHistory', 'readwrite');
    const store = tx.objectStore('DiagnosticsHistory');
    ids.forEach(id => {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
            const data = req.result;
            data.synced = true;
            store.put(data);
        }
      };
    });
  }
}
