// Storage utility that works in both browser and Electron environments
// Abstracts localStorage to make the app Electron-safe

interface StorageOptions {
  key: string;
  value?: string;
}

/**
 * Safe storage utility that works in both browser and Electron
 * Uses localStorage in browser, will use Electron storage in future
 */
export class SafeStorage {
  /**
   * Get an item from storage
   */
  static getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('Failed to get item from storage:', error);
      return null;
    }
  }

  /**
   * Set an item in storage
   */
  static setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn('Failed to set item in storage:', error);
      return false;
    }
  }

  /**
   * Remove an item from storage
   */
  static removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('Failed to remove item from storage:', error);
      return false;
    }
  }

  /**
   * Clear all storage
   */
  static clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Get all keys in storage
   */
  static keys(): string[] {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    } catch (error) {
      console.warn('Failed to get storage keys:', error);
      return [];
    }
  }

  /**
   * Check if storage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * JSON storage helpers for complex objects
 */
export class JSONStorage {
  /**
   * Get and parse a JSON object from storage
   */
  static getItem<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = SafeStorage.getItem(key);
      if (item === null) return defaultValue || null;
      return JSON.parse(item);
    } catch (error) {
      console.warn(`Failed to parse JSON for key "${key}":`, error);
      return defaultValue || null;
    }
  }

  /**
   * Stringify and store a JSON object
   */
  static setItem<T>(key: string, value: T): boolean {
    try {
      return SafeStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to stringify JSON for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Remove a JSON object from storage
   */
  static removeItem(key: string): boolean {
    return SafeStorage.removeItem(key);
  }
}

/**
 * Session storage utility (same interface as SafeStorage but for sessionStorage)
 */
export class SafeSessionStorage {
  /**
   * Get an item from session storage
   */
  static getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.warn('Failed to get item from session storage:', error);
      return null;
    }
  }

  /**
   * Set an item in session storage
   */
  static setItem(key: string, value: string): boolean {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn('Failed to set item in session storage:', error);
      return false;
    }
  }

  /**
   * Remove an item from session storage
   */
  static removeItem(key: string): boolean {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('Failed to remove item from session storage:', error);
      return false;
    }
  }

  /**
   * Check if session storage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__session_storage_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}
