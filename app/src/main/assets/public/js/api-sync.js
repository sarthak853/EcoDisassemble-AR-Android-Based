/**
 * EcoDisassemble AR - Telemetry Cloud Sync (Privacy Gate)
 * 
 * Enforces strict on-device data minimization before transmitting
 * replacement part telemetry to Supabase. Guarantees that photos,
 * device serials, and diagnostic notes are never sent to the cloud.
 */

export class APISync {
  constructor(dbStore) {
    this.dbStore = dbStore;
    this.endpoint = 'https://jcfucwcgtsgaircsxjgd.supabase.co/rest/v1/telemetry_syncs';
    this.apiKey = 'sb_publishable_W58bAMFyLMptnUvVeeagnQ_bqpVcaR7';
    this.lastSyncTime = 0;
    this.rateLimitInterval = 10000; // 10 second debounce for demo (normally 1 hour in prod)
    this.maxPayloadBytes = 10240;    // Hard 10KB payload limit
  }

  /**
   * Validates and transmits the replacement part manifest to Supabase.
   * 
   * @param {Array<{ part_name: string, quantity: number }>} manifestData
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async syncToCloud(manifestData) {
    // 1. Rate Limiting / Debounce Protection
    const now = Date.now();
    if (now - this.lastSyncTime < this.rateLimitInterval) {
      const waitSec = Math.ceil((this.rateLimitInterval - (now - this.lastSyncTime)) / 1000);
      throw new Error(`Rate limit active. Please wait ${waitSec}s before syncing again.`);
    }
    this.lastSyncTime = now;

    // 2. Strict JSON Schema Validation (Privacy Invariant: part_name & quantity only)
    if (!Array.isArray(manifestData) || manifestData.length === 0) {
      throw new Error("Invalid payload: expected non-empty array of parts.");
    }

    const payload = manifestData.map(item => ({
      part_name: String(item.part_name || 'unknown').substring(0, 120),
      quantity: Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1))
    }));

    // 3. Payload Size Boundary Check
    const serialized = JSON.stringify(payload);
    if (new TextEncoder().encode(serialized).length > this.maxPayloadBytes) {
      throw new Error("Payload size limit exceeded (max 10KB). Too many items.");
    }

    // 4. Timeouts & Abort Controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    try {
      console.log("[APISync] Transmitting minimized manifest through privacy gate:", payload);

      // Live Supabase PostgREST Fetch Call
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ payload }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase API responded with status ${response.status}: ${errorText}`);
      }

      clearTimeout(timeoutId);

      // Mark records as synced in IndexedDB
      if (this.dbStore && typeof this.dbStore.markSynced === 'function') {
        const unsynced = await this.dbStore.getUnsynced();
        await this.dbStore.markSynced(unsynced.map(r => r.id));
      }

      return { success: true, message: `Successfully synchronized ${payload.length} part(s).` };
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("[APISync] Network sync notice:", err);
      return { success: false, message: err.name === 'AbortError' ? 'Sync timed out after 10s.' : err.message };
    }
  }
}
