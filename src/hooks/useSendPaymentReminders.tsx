import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PaymentReminderResult {
  success: boolean;
  sent: number;
  skipped: number;
  overdue: number;
  upcoming_72h: number;
  upcoming_24h: number;
  errors: string[];
}

export function useSendPaymentReminders() {
  return useMutation({
    mutationFn: async (): Promise<PaymentReminderResult> => {
      const { data, error } = await supabase.functions.invoke('send-payment-reminders');

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