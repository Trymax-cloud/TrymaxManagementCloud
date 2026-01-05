import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PaymentReminderSummary {
  sent: number;
  skipped: number;
  errors: number;
  details: {
    sent: Array<{ paymentId: string; email: string; type: string }>;
    skipped: Array<{ paymentId: string; reason: string }>;
    errors: Array<{ paymentId: string; error: string }>;
  };
}

interface PaymentReminderResult {
  success: boolean;
  message: string;
  summary: PaymentReminderSummary;
  timestamp: string;
  dryRun: boolean;
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
