import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { JSONStorage, SafeStorage } from "@/utils/storage";
import { updateNotificationSettings } from "@/utils/notificationManager";

// ============= Types =============

export interface NotificationPreferences {
  assignmentReminders: boolean;
  emergencyAlerts: boolean;
  dailySummary: boolean;
  paymentReminders: boolean;
  messageNotifications: boolean;
  ratingNotifications: boolean;
  meetingNotifications: boolean;
}

export interface ReminderTiming {
  defaultReminderTime: string; // HH:mm format e.g., "09:00"
  remindBeforeDueDays: number; // 1, 3, or 7
}

export interface AppearanceSettings {
  darkMode: boolean;
  compactView: boolean;
  animationsEnabled: boolean;
}

export interface AutoArchiveSettings {
  enabled: boolean;
  delayDays: number; // 0 = immediately, or number of days
}

export interface SystemSettings {
  defaultPriority: 'normal' | 'high';
  ratingScale: '5' | '10';
  sessionTimeout: string; // '15', '30', '60', 'never'
}

export interface UserSettings {
  notifications: NotificationPreferences;
  reminderTiming: ReminderTiming;
  appearance: AppearanceSettings;
  autoArchive: AutoArchiveSettings;
  system: SystemSettings;
}

// ============= Default Values =============

const defaultSettings: UserSettings = {
  notifications: {
    assignmentReminders: true,
    emergencyAlerts: true,
    dailySummary: false,
    paymentReminders: true,
    messageNotifications: true,
    ratingNotifications: true,
    meetingNotifications: true,
  },
  reminderTiming: {
    defaultReminderTime: '09:00',
    remindBeforeDueDays: 3,
  },
  appearance: {
    darkMode: false,
    compactView: false,
    animationsEnabled: true,
  },
  autoArchive: {
    enabled: false,
    delayDays: 0,
  },
  system: {
    defaultPriority: 'normal',
    ratingScale: '5',
    sessionTimeout: '30',
  },
};

// ============= Storage Keys =============

const STORAGE_KEY = 'ewpm_user_settings';
const ARCHIVED_TASKS_KEY = 'ewpm_archived_tasks';

// ============= Context Interface =============

interface SettingsContextValue {
  settings: UserSettings;
  archivedTaskIds: Set<string>;
  
  // Notification setters
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;
  updateReminderTiming: (timing: Partial<ReminderTiming>) => void;
  
  // Appearance setters
  updateAppearance: (appearance: Partial<AppearanceSettings>) => void;
  toggleDarkMode: () => void;
  toggleCompactView: () => void;
  toggleAnimations: () => void;
  
  // Auto-archive setters
  updateAutoArchive: (settings: Partial<AutoArchiveSettings>) => void;
  
  // Archive management
  archiveTask: (taskId: string) => void;
  unarchiveTask: (taskId: string) => void;
  isTaskArchived: (taskId: string) => boolean;
  
  // System setters
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;
  
  // Utility
  resetSettings: () => void;
  shouldShowNotification: (type: keyof NotificationPreferences) => boolean;
}

// ============= Context =============

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// ============= Provider =============

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<UserSettings>(() => {
  const stored = JSONStorage.getItem<UserSettings>(STORAGE_KEY);
  if (stored) {
    // Merge with defaults to handle new settings added over time
    return {
      ...defaultSettings,
      ...stored,
      notifications: { ...defaultSettings.notifications, ...stored.notifications },
      reminderTiming: { ...defaultSettings.reminderTiming, ...stored.reminderTiming },
      appearance: { ...defaultSettings.appearance, ...stored.appearance },
      autoArchive: { ...defaultSettings.autoArchive, ...stored.autoArchive },
      system: { ...defaultSettings.system, ...stored.system },
    };
  }
  return defaultSettings;
});

const [archivedTaskIds, setArchivedTaskIds] = useState<Set<string>>(() => {
  const stored = JSONStorage.getItem<string[]>(ARCHIVED_TASKS_KEY);
  if (stored) {
    return new Set(stored);
  }
  return new Set();
});

// Persist settings to storage
useEffect(() => {
  JSONStorage.setItem(STORAGE_KEY, settings);
}, [settings]);

// Update notification manager with current settings
useEffect(() => {
  updateNotificationSettings(settings);
}, [settings]);

// Persist archived tasks to storage
useEffect(() => {
  JSONStorage.setItem(ARCHIVED_TASKS_KEY, [...archivedTaskIds]);
}, [archivedTaskIds]);

  // Apply dark mode to document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.appearance.darkMode]);

  // Apply compact view to document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance.compactView) {
      root.classList.add('compact');
    } else {
      root.classList.remove('compact');
    }
  }, [settings.appearance.compactView]);

  // Apply animations setting to document
  useEffect(() => {
    const root = document.documentElement;
    if (settings.appearance.animationsEnabled) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }
  }, [settings.appearance.animationsEnabled]);

  // ============= Update Functions =============

  const updateNotificationPreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, ...prefs },
    }));
  }, []);

  const updateReminderTiming = useCallback((timing: Partial<ReminderTiming>) => {
    setSettings(prev => ({
      ...prev,
      reminderTiming: { ...prev.reminderTiming, ...timing },
    }));
  }, []);

  const updateAppearance = useCallback((appearance: Partial<AppearanceSettings>) => {
    setSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, ...appearance },
    }));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, darkMode: !prev.appearance.darkMode },
    }));
  }, []);

  const toggleCompactView = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, compactView: !prev.appearance.compactView },
    }));
  }, []);

  const toggleAnimations = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      appearance: { ...prev.appearance, animationsEnabled: !prev.appearance.animationsEnabled },
    }));
  }, []);

  const updateAutoArchive = useCallback((autoArchive: Partial<AutoArchiveSettings>) => {
    setSettings(prev => ({
      ...prev,
      autoArchive: { ...prev.autoArchive, ...autoArchive },
    }));
  }, []);

  const updateSystemSettings = useCallback((system: Partial<SystemSettings>) => {
    setSettings(prev => ({
      ...prev,
      system: { ...prev.system, ...system },
    }));
  }, []);

  // ============= Archive Functions =============

  const archiveTask = useCallback((taskId: string) => {
    setArchivedTaskIds(prev => new Set([...prev, taskId]));
  }, []);

  const unarchiveTask = useCallback((taskId: string) => {
    setArchivedTaskIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
  }, []);

  const isTaskArchived = useCallback((taskId: string) => {
    return archivedTaskIds.has(taskId);
  }, [archivedTaskIds]);

  // ============= Utility Functions =============

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    setArchivedTaskIds(new Set());
    SafeStorage.removeItem(STORAGE_KEY);
    SafeStorage.removeItem(ARCHIVED_TASKS_KEY);
  }, []);

  const shouldShowNotification = useCallback((type: keyof NotificationPreferences) => {
    return settings.notifications[type];
  }, [settings.notifications]);

  // ============= Context Value =============

  const value: SettingsContextValue = {
    settings,
    archivedTaskIds,
    updateNotificationPreferences,
    updateReminderTiming,
    updateAppearance,
    toggleDarkMode,
    toggleCompactView,
    toggleAnimations,
    updateAutoArchive,
    archiveTask,
    unarchiveTask,
    isTaskArchived,
    updateSystemSettings,
    resetSettings,
    shouldShowNotification,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============= Hook =============

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Export types for use in other files
export type { SettingsContextValue };
