import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ReminderResponse {
  message: string;
  sent: number;
  failed: number;
  total: number;
  processed_ids: string[];
}

interface SendRemindersRequest {
  payment_ids?: string[];
}

export function usePaymentReminders() {
  const queryClient = useQueryClient();

  const sendRemindersMutation = useMutation({
    mutationFn: async (request: SendRemindersRequest = {}) => {
      const { data, error } = await supabase.functions.invoke<ReminderResponse>(
        "send-payment-reminders",
        {
          body: request,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("No response from payment reminder service");
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.sent > 0) {
        toast({
          title: "Reminders Sent Successfully",
          description: `Sent ${data.sent} reminder${data.sent > 1 ? 's' : ''} successfully`,
        });
      } else {
        toast({
          title: "No Reminders Sent",
          description: data.message || "No eligible payments found",
          variant: "default",
        });
      }

      // Refresh payments data to show updated reminder timestamps
      queryClient.invalidateQueries({ queryKey: ["client_payments"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Reminders",
        description: error.message || "An error occurred while sending reminders",
        variant: "destructive",
      });
    },
  });

  return {
    sendReminders: sendRemindersMutation.mutate,
    sendRemindersAsync: sendRemindersMutation.mutateAsync,
    isLoading: sendRemindersMutation.isPending,
  };
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("client_payments")
        .delete()
        .eq("id", paymentId);

      if (error) {
        throw new Error(error.message);
      }

      return paymentId;
    },
    onSuccess: () => {
      toast({
        title: "Payment Deleted",
        description: "Payment has been removed successfully",
      });

      // Refresh payments data
      queryClient.invalidateQueries({ queryKey: ["client_payments"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete Payment",
        description: error.message || "An error occurred while deleting the payment",
        variant: "destructive",
      });
    },
  });

  return {
    deletePayment: deletePaymentMutation.mutate,
    deletePaymentAsync: deletePaymentMutation.mutateAsync,
    isLoading: deletePaymentMutation.isPending,
  };
}
