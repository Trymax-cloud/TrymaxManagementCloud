import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSendPaymentReminders() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-payment-reminders');

      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      console.log('Payment reminders processed:', result);
    },
    onError: (error) => {
      console.error('Failed to process payment reminders:', error);
    }
  });
}