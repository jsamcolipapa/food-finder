import { Injectable } from '@angular/core';

const PREFIX = 'crave:';

/** localStorage wrapper that degrades to in-memory defaults when storage is blocked. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Private mode or quota exceeded: the app keeps working for this session only.
    }
  }
}
