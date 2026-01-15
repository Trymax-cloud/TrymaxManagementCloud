import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface ClientPayment {
  id: string;
  client_name: string;
  project_id: string | null;
  invoice_amount: number;
  amount_paid: number;
  invoice_date: string;
  due_date: string;
  status: "pending" | "partially_paid" | "paid";
  responsible_user_id: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends ClientPayment {
  project?: {
    id: string;
    name: string;
  };
  responsible_user?: {
    id: string;
    name: string;
  };
}

export function usePayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select(`
          id,
          client_name,
          project_id,
          invoice_amount,
          amount_paid,
          invoice_date,
          due_date,
          status,
          responsible_user_id,
          remarks,
          created_at,
          updated_at
        `)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as ClientPayment[];
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 60 seconds
    placeholderData: (previousData) => previousData, // Replaces keepPreviousData
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useMyPayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select(`
          id,
          client_name,
          project_id,
          invoice_amount,
          amount_paid,
          invoice_date,
          due_date,
          status,
          responsible_user_id,
          remarks,
          created_at,
          updated_at
        `)
        .eq("responsible_user_id", user!.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as ClientPayment[];
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 60 seconds
    placeholderData: (previousData) => previousData,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useOverduePayments() {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: ["overdue-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select(`
          id,
          client_name,
          project_id,
          invoice_amount,
          amount_paid,
          invoice_date,
          due_date,
          status,
          responsible_user_id,
          remarks,
          created_at,
          updated_at
        `)
        .neq("status", "paid")
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as ClientPayment[];
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 60 seconds
    placeholderData: (previousData) => previousData,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export interface CreatePaymentInput {
  client_name: string;
  project_id?: string;
  invoice_amount: number;
  invoice_date: string;
  due_date: string;
  responsible_user_id: string;
  remarks?: string;
}

export function useCreatePayment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const { data, error } = await supabase
        .from("client_payments")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Targeted invalidation instead of global
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
      // Also invalidate analytics queries
      queryClient.invalidateQueries({ queryKey: ["payment-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["payment-trends"] });
      queryClient.invalidateQueries({ queryKey: ["client-payment-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-payment-reminders"] });
      toast({
        title: "Payment created",
        description: "The payment record has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useUpdatePayment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      amount_paid,
    }: { 
        id: string; 
        status?: ClientPayment["status"];
        amount_paid?: number;
      }) => {
      console.log("🔄 Updating payment with data:", { id, status, amount_paid });
      
      // First, check if payment exists and user has access
      const { data: existingPayment, error: fetchError } = await supabase
        .from("client_payments")
        .select("id, status, amount_paid, invoice_amount, responsible_user_id")
        .eq("id", id)
        .single();
      
      if (fetchError) {
        console.error("❌ Error fetching payment:", fetchError);
        throw new Error("Payment not found or you don't have permission to update it");
      }
      
      if (!existingPayment) {
        throw new Error("Payment not found");
      }
      
      console.log("📋 Existing payment:", existingPayment);
      
      const updateData: any = {};
      
      if (status !== undefined) {
        updateData.status = status;
      }
      
      if (amount_paid !== undefined) {
        updateData.amount_paid = amount_paid;
      }
      
      console.log("📤 Sending update data:", updateData);
      
      const { data, error } = await supabase
        .from("client_payments")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("❌ Supabase error:", error);
        if (error.code === 'PGRST116') {
          throw new Error("Payment not found or update failed. Please refresh and try again.");
        }
        throw error;
      }
      
      console.log("✅ Update successful:", data);
      return data;
    },
    onSuccess: () => {
      // Targeted invalidation instead of global
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
      // Also invalidate analytics queries
      queryClient.invalidateQueries({ queryKey: ["payment-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["payment-trends"] });
      queryClient.invalidateQueries({ queryKey: ["client-payment-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-payment-reminders"] });
      toast({
        title: "Payment updated",
        description: "The payment has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useDeletePayment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_payments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Targeted invalidation instead of global
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
      // Also invalidate analytics queries
      queryClient.invalidateQueries({ queryKey: ["payment-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["payment-trends"] });
      queryClient.invalidateQueries({ queryKey: ["client-payment-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-payment-reminders"] });
      toast({
        title: "Payment deleted",
        description: "The payment has been removed.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}
