/**
 * Local Storage Management using IndexedDB
 */

const DB_NAME = 'EcoDisassembleDB';
const DB_VERSION = 1;
const STORE_NAME = 'repairs';

let db;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('synced', 'synced', { unique: false });
            }
        };
    });
}

export function saveRepairSession(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const payload = {
            ...data,
            date: new Date().toISOString(),
            synced: false
        };

        const request = store.add(payload);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function getUnsyncedRepairs() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('synced');
        
        const request = index.getAll(IDBKeyRange.only(false));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function markAsSynced(ids) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        ids.forEach(id => {
            const request = store.get(id);
            request.onsuccess = () => {
                const data = request.result;
                if (data) {
                    data.synced = true;
                    store.put(data);
                }
            };
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
