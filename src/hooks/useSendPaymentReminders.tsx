import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/contexts/SettingsContext';

interface PaymentReminderResult {
  success: boolean;
  sent: number;
  skipped: number;
  overdue: number;
  upcoming_72h: number;
  upcoming_24h: number;
}

export function useSendPaymentReminders() {
  const { settings } = useSettings();

  return useMutation({
    mutationFn: async (automatic: boolean = true): Promise<PaymentReminderResult> => {
      const { data, error } = await supabase.functions.invoke('send-payment-reminders', {
        body: { 
          automatic,
          reminderDays: settings.reminderTiming.remindBeforeDueDays,
          reminderTime: settings.reminderTiming.defaultReminderTime
        }
      });

      if (error) throw error;
      return data as PaymentReminderResult;
    },
    onSuccess: (result) => {
      console.log('Payment reminders processed:', result);
    },
    onError: (error) => {
      console.error('Failed to process payment reminders:', error);
    }
  });
}