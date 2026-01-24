import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { desktopNotify } from "@/utils/desktopNotify";

interface ManualReminderInput {
  paymentId: string;
  clientName: string;
  invoiceAmount: number;
  dueDate: string;
  responsibleUserId?: string;
}

export function useSendManualPaymentReminder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ManualReminderInput) => {
      if (!user) throw new Error("Not authenticated");

      // Send email reminder using manual-only Supabase function
      const { data: reminderResult, error: reminderError } = await supabase.functions.invoke('send-payment-reminders', {
        body: {
          automatic: false, // Explicitly manual
          paymentIds: [input.paymentId], // Only specific payment
          paymentRemindersEnabled: true
        }
      });

      if (reminderError) {
        console.error("Failed to send manual reminder:", reminderError);
        throw new Error("Failed to send reminder email");
      }

      // Insert database notification for responsible employee
      if (input.responsibleUserId && input.responsibleUserId !== user.id) {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert({
            user_id: input.responsibleUserId,
            type: "payment_reminder",
            title: "Payment Reminder",
            message: `Payment reminder sent for ${input.clientName}`,
            priority: "normal",
            related_entity_type: "payment",
            related_entity_id: input.paymentId,
            action_url: "/payments",
            is_read: false,
          });

        if (notificationError) {
          console.error("Failed to create notification:", notificationError);
        } else {
          // Create desktop notification for responsible employee
          try {
            await desktopNotify(
              "Payment Reminder",
              `Reminder sent for ${input.clientName}`,
              "/payments",
              {
                tag: `payment-reminder-${input.paymentId}`,
                urgency: "normal",
                requireInteraction: false
              }
            );
          } catch (error) {
            console.error("Failed to send desktop notification:", error);
          }
        }
      }

      return reminderResult;
    },
    onSuccess: () => {
      // Invalidate notification queries to update bell icon count
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      
      toast({
        title: "Reminder sent",
        description: "Payment reminder has been sent successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to send reminder",
        description: error.message || "Failed to send payment reminder. Please try again.",
        variant: "destructive",
      });
    }
  });
}
