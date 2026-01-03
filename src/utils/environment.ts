// Environment detection utility
// Helps determine if the app is running in browser or Electron environment

export interface EnvironmentInfo {
  isElectron: boolean;
  isBrowser: boolean;
  platform: string;
  version?: string;
}

/**
 * Detects the current environment (browser vs Electron)
 */
export function getEnvironment(): EnvironmentInfo {
  // Check for Electron environment
  const userAgent = navigator.userAgent.toLowerCase();
  const isElectron = userAgent.includes('electron');
  
  return {
    isElectron,
    isBrowser: !isElectron,
    platform: isElectron ? 'electron' : 'browser',
    version: isElectron ? getUserAgentVersion(userAgent) : undefined,
  };
}

/**
 * Extracts version from user agent string
 */
function getUserAgentVersion(userAgent: string): string {
  const match = userAgent.match(/electron\/(\d+\.\d+\.\d+)/i);
  return match ? match[1] : 'unknown';
}

/**
 * Checks if we're in a development environment
 */
export function isDevelopment(): boolean {
  return import.meta.env?.MODE === 'development';
}

/**
 * Safe way to access environment variables
 * Works in both browser and Electron environments
 */
export function getEnvVar(key: string): string | undefined {
  // Try different ways to access environment variables
  return import.meta.env?.[key] || 
         (typeof window !== 'undefined' && (window as any).__ENV?.[key]);
}

/**
 * Platform-specific feature detection
 */
export const platformFeatures = {
  // Notifications are handled by the utility function
  notifications: {
    supported: true, // Both platforms support notifications
    requiresPermission: true, // Both platforms require permission
  },
  
  // File system access (Electron only)
  fileSystem: {
    supported: false, // Abstracted away - don't use directly
  },
  
  // Process access (Electron only)
  process: {
    supported: false, // Abstracted away - don't use directly
  },
  
  // Path utilities (Electron only)
  path: {
    supported: false, // Abstracted away - don't use directly
  },
};

/**
 * Validates that we're not using forbidden APIs
 * Call this during development to catch Electron-specific API usage
 */
export function validateElectronSafety(): string[] {
  const violations: string[] = [];
  
  // Check for common Electron-specific globals
  const forbiddenGlobals = ['require', 'Buffer', 'global', '__dirname', '__filename'];
  forbiddenGlobals.forEach(global => {
    if (typeof (window as any)[global] !== 'undefined') {
      violations.push(`Forbidden global detected: ${global}`);
    }
  });
  
  return violations;
}
