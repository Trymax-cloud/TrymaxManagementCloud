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
      console.log("Attempting to delete payment:", paymentId);
      
      const { error } = await supabase
        .from("client_payments")
        .delete()
        .eq("id", paymentId);

      if (error) {
        console.error("Supabase delete error:", error);
        throw new Error(error.message);
      }

      console.log("Payment deleted successfully:", paymentId);
      return paymentId;
    },
    onMutate: async (paymentId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["client_payments"] });
      
      // Snapshot the previous value
      const previousPayments = queryClient.getQueryData(["client_payments"]);
      
      // Optimistically remove the payment from cache
      queryClient.setQueryData(["client_payments"], (old: any) => {
        if (!old) return old;
        return old.filter((payment: any) => payment.id !== paymentId);
      });
      
      return { previousPayments };
    },
    onSuccess: (paymentId) => {
      console.log("Delete mutation success for payment:", paymentId);
      toast({
        title: "Payment Deleted",
        description: "Payment has been removed successfully",
      });

      // Invalidate to sync with server (but won't cause visible flicker due to optimistic update)
      queryClient.invalidateQueries({ queryKey: ["client_payments"] });
    },
    onError: (error, paymentId, context) => {
      console.error("Delete mutation error:", error);
      
      // Rollback on error
      if (context?.previousPayments) {
        queryClient.setQueryData(["client_payments"], context.previousPayments);
      }
      
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
