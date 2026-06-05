/**
 * GeminiKeyManager — Shared API key pool with automatic rotation.
 *
 * Keys are loaded from the DB (gemini_api_keys setting, JSON array).
 * Falls back to the legacy single key (gemini_api_key) if the list is empty.
 *
 * Usage:
 *   await geminiKeyManager.load();
 *   const key = geminiKeyManager.current();   // get active key
 *   geminiKeyManager.rotate();                // advance to next key
 *   const response = await geminiKeyManager.fetchWithRotation(url, options);
 */

import { getDb } from './db';

const SETTING_KEYS_LIST = 'gemini_api_keys';
const SETTING_KEY_LEGACY = 'gemini_api_key';

class GeminiKeyManager {
  private keys: string[] = [];
  private index = 0;
  private loaded = false;

  /** Load (or reload) the key pool from the database. */
  async load(): Promise<void> {
    try {
      const db = await getDb();

      // Try the list first
      const listRes = await db.select<{ value: string }[]>(
        `SELECT value FROM app_settings WHERE key = '${SETTING_KEYS_LIST}'`
      );
      if (listRes.length > 0 && listRes[0].value) {
        try {
          const parsed: string[] = JSON.parse(listRes[0].value);
          const valid = parsed.filter(k => k && k.trim().length > 0);
          if (valid.length > 0) {
            this.keys = valid;
            this.index = 0;
            this.loaded = true;
            return;
          }
        } catch (_) {}
      }

      // Fall back to the single legacy key
      const legacyRes = await db.select<{ value: string }[]>(
        `SELECT value FROM app_settings WHERE key = '${SETTING_KEY_LEGACY}'`
      );
      if (legacyRes.length > 0 && legacyRes[0].value && legacyRes[0].value.trim()) {
        this.keys = [legacyRes[0].value.trim()];
        this.index = 0;
      } else {
        this.keys = [];
        this.index = 0;
      }
      this.loaded = true;
    } catch (e) {
      console.error('[GeminiKeyManager] Error loading keys:', e);
    }
  }

  /** Returns the currently active API key, or empty string if none. */
  current(): string {
    if (this.keys.length === 0) return '';
    return this.keys[this.index] || '';
  }

  /** Advance to the next key. Wraps around. */
  rotate(): void {
    if (this.keys.length <= 1) return;
    this.index = (this.index + 1) % this.keys.length;
    console.info(`[GeminiKeyManager] Rotated to key index ${this.index}`);
  }

  /** True if at least one key is configured. */
  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  /** How many keys are in the pool. */
  count(): number {
    return this.keys.length;
  }

  /** Current key index (1-based for display). */
  currentIndex(): number {
    return this.index + 1;
  }

  /**
   * Wraps fetch() with automatic key rotation on HTTP 429 or 403.
   * buildUrl receives the current key and must return the full URL.
   * Tries all keys once before giving up.
   */
  async fetchWithRotation(
    buildUrl: (key: string) => string,
    options: RequestInit,
    maxRetries?: number
  ): Promise<Response> {
    if (!this.loaded) await this.load();

    const total = this.keys.length || 1;
    const attempts = maxRetries ?? total;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const key = this.current();
      if (!key) {
        // No keys at all — just perform the request with empty key so caller gets a clear error
        return fetch(buildUrl(''), options);
      }

      const url = buildUrl(key);
      let response: Response;
      try {
        response = await fetch(url, options);
      } catch (networkErr) {
        // Network failure — don't rotate, propagate
        throw networkErr;
      }

      if (response.status === 429 || response.status === 403) {
        console.warn(
          `[GeminiKeyManager] Key index ${this.index} returned ${response.status}. Rotating…`
        );
        this.rotate();
        // Brief pause before next attempt
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      return response;
    }

    // All keys exhausted — make one final attempt with current key and return whatever comes
    return fetch(buildUrl(this.current()), options);
  }
}

// Singleton exported for use across all modules
export const geminiKeyManager = new GeminiKeyManager();
