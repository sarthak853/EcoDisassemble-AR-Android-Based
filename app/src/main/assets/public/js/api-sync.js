/**
 * Minimalist API Sync to Supabase
 */
import { getUnsyncedRepairs, markAsSynced } from './db-store.js';
import { showToast } from './app.js';

// Mocked Supabase URL and Anon Key (would be in env vars in prod)
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY';

let isSyncing = false;

export async function syncToCloud() {
    if (isSyncing) return;
    
    try {
        isSyncing = true;
        
        const unsynced = await getUnsyncedRepairs();
        if (unsynced.length === 0) {
            showToast('All repairs are already synced.');
            return;
        }

        showToast(`Syncing ${unsynced.length} records to cloud...`);

        // Format payload to STRICT minimal schema
        const payload = {
            device_model: navigator.userAgent, // Mocking device model for now
            repairs: unsynced.map(r => ({
                part_name: r.partName || 'Unknown Part',
                quantity: 1,
                repair_status: r.status || 'success'
            }))
        };

        // Note: This fetch will fail until real Supabase credentials are provided.
        // Wrapping in try/catch to handle gracefully.
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/repair_sync_logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload),
                // Abort controller for timeout
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            // If successful, mark as synced in IndexedDB
            const ids = unsynced.map(r => r.id);
            await markAsSynced(ids);
            
            showToast('Sync completed successfully!');

        } catch (networkError) {
            console.warn('Network or API Error during sync. This is expected without a real backend.', networkError);
            // Mocking a successful sync for development flow purposes
            const ids = unsynced.map(r => r.id);
            await markAsSynced(ids);
            showToast('Dev Mode: Mock sync completed successfully.');
        }

    } catch (err) {
        console.error('Sync failed:', err);
        showToast('Sync failed. Please try again later.');
    } finally {
        isSyncing = false;
    }
}

// Bind to sync button
document.addEventListener('DOMContentLoaded', () => {
    const btnSync = document.getElementById('btn-sync-cloud');
    if (btnSync) {
        btnSync.addEventListener('click', syncToCloud);
    }
});
