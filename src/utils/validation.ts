// Development validation utility
// Ensures the app is Electron-safe during development

import { validateElectronSafety } from "@/utils/environment";

/**
 * Development-time validation to catch Electron-specific API usage
 * Call this in development mode to validate the codebase
 */
export function validateElectronCompatibility(): void {
  // Only run in development
  if (process?.env?.NODE_ENV !== 'development' && import.meta.env?.MODE !== 'development') {
    return;
  }

  const violations = validateElectronSafety();
  
  if (violations.length > 0) {
    console.group('🚨 Electron Compatibility Issues Detected');
    violations.forEach((violation, index) => {
      console.error(`${index + 1}. ${violation}`);
    });
    console.groupEnd();
    console.warn('Please fix these issues before deploying to Electron');
  } else {
    console.log('✅ Electron compatibility check passed');
  }
}

/**
 * Validates that we're not using forbidden APIs in critical components
 */
export function validateComponentSafety(componentName: string): boolean {
  const violations = validateElectronSafety();
  
  if (violations.length > 0) {
    console.error(`❌ Component "${componentName}" has Electron compatibility issues:`, violations);
    return false;
  }
  
  return true;
}

/**
 * Runtime check for Electron environment features
 */
export const electronChecks = {
  /**
   * Check if window.electron bridge is available
   */
  hasElectronBridge: (): boolean => {
    return typeof window !== 'undefined' && !!(window as any).electron;
  },

  /**
   * Check if we can safely use desktop notifications
   */
  canUseDesktopNotifications: (): boolean => {
    return typeof window !== 'undefined' && 
           (!!(window as any).electron?.notify || 'Notification' in window);
  },

  /**
   * Check if we're in a secure context (required for some APIs)
   */
  isSecureContext: (): boolean => {
    return typeof window !== 'undefined' && window.isSecureContext;
  },

  /**
   * Check if we have access to required browser APIs
   */
  hasRequiredAPIs: (): boolean => {
    return typeof window !== 'undefined' && 
           'fetch' in window && 
           'localStorage' in window;
  },
};

/**
 * Development-time validation hook
 */
export function useElectronValidation() {
  // Only run in development
  const isDevelopment = process?.env?.NODE_ENV === 'development' || 
                       import.meta.env?.MODE === 'development';

  if (isDevelopment) {
    // Validate on mount
    validateElectronCompatibility();
    
    // Set up periodic validation (every 30 seconds in dev)
    const interval = setInterval(() => {
      validateElectronCompatibility();
    }, 30000);

    return () => clearInterval(interval);
  }

  return () => {};
}

/**
 * Safe way to access environment variables
 */
export function safeGetEnv(key: string): string | undefined {
  // Try different ways to access environment variables safely
  try {
    return process?.env?.[key] || 
           import.meta.env?.[key] || 
           (typeof window !== 'undefined' && (window as any).__ENV?.[key]);
  } catch {
    return undefined;
  }
}

/**
 * Validates that we're not using Node.js specific APIs
 */
export function validateNodeAPISafety(): string[] {
  const violations: string[] = [];
  
  // Check for Node.js globals that shouldn't be used in browser/Electron renderer
  const nodeGlobals = ['require', 'module', 'exports', '__dirname', '__filename', 'Buffer', 'global'];
  
  nodeGlobals.forEach(globalName => {
    if (typeof (window as any)[globalName] !== 'undefined') {
      violations.push(`Node.js global detected: ${globalName}`);
    }
  });

  // Check for process usage (should be abstracted)
  if (typeof process !== 'undefined' && !electronChecks.hasElectronBridge()) {
    violations.push('Direct process access detected (should be abstracted)');
  }

  return violations;
}
