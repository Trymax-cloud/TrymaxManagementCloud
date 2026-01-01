import { useEffect, useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { differenceInDays } from 'date-fns';

interface CompletedTask {
  id: string;
  status: string;
  completion_date: string | null;
}

/**
 * Hook that handles auto-archiving of completed tasks based on user settings.
 * Should be used in components that display task lists.
 */
export function useAutoArchive(tasks: CompletedTask[] | undefined) {
  const { settings, archiveTask, isTaskArchived } = useSettings();
  const { enabled, delayDays } = settings.autoArchive;

  useEffect(() => {
    if (!enabled || !tasks) return;

    const now = new Date();

    tasks.forEach(task => {
      // Skip if already archived
      if (isTaskArchived(task.id)) return;

      // Only archive completed tasks
      if (task.status !== 'completed') return;

      // Must have a completion date
      if (!task.completion_date) return;

      const completionDate = new Date(task.completion_date);
      const daysSinceCompletion = differenceInDays(now, completionDate);

      // Archive if delay threshold is met
      if (daysSinceCompletion >= delayDays) {
        archiveTask(task.id);
      }
    });
  }, [enabled, delayDays, tasks, archiveTask, isTaskArchived]);

  // Filter function to exclude archived tasks
  const filterArchived = useCallback(<T extends { id: string }>(items: T[]): T[] => {
    return items.filter(item => !isTaskArchived(item.id));
  }, [isTaskArchived]);

  // Get only archived tasks
  const getArchivedOnly = useCallback(<T extends { id: string }>(items: T[]): T[] => {
    return items.filter(item => isTaskArchived(item.id));
  }, [isTaskArchived]);

  return {
    filterArchived,
    getArchivedOnly,
    isTaskArchived,
  };
}

/**
 * Hook to manually trigger archive check
 */
export function useManualArchive() {
  const { settings, archiveTask, unarchiveTask, isTaskArchived } = useSettings();

  const manualArchive = useCallback((taskId: string) => {
    archiveTask(taskId);
  }, [archiveTask]);

  const manualUnarchive = useCallback((taskId: string) => {
    unarchiveTask(taskId);
  }, [unarchiveTask]);

  return {
    manualArchive,
    manualUnarchive,
    isTaskArchived,
    autoArchiveEnabled: settings.autoArchive.enabled,
  };
}
