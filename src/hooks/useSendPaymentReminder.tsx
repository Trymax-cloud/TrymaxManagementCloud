import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PaymentReminderData {
  paymentId: string;
  recipientEmail: string;
  recipientName: string;
  amount: number;
  dueDate: string;
  clientName?: string;
  projectName?: string;
  customMessage?: string;
}

export function useSendPaymentReminder() {
  return useMutation({
    mutationFn: async (data: PaymentReminderData) => {
      const { data: result, error } = await supabase.functions.invoke('send-payment-reminder', {
        body: {
          type: 'payment_reminder',
          ...data
        }
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      console.log('Payment reminder sent successfully');
    },
    onError: (error) => {
      console.error('Failed to send payment reminder:', error);
    }
  });
}
