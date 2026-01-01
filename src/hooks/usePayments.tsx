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
        .select("*")
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as ClientPayment[];
    },
    enabled: !!user,
  });
}

export function useMyPayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*")
        .eq("responsible_user_id", user!.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as ClientPayment[];
    },
    enabled: !!user,
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
        .select("*")
        .neq("status", "paid")
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as ClientPayment[];
    },
    enabled: !!user,
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
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
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
      ...updates
    }: Partial<CreatePaymentInput> & { 
      id: string; 
      status?: ClientPayment["status"];
      amount_paid?: number;
    }) => {
      const { data, error } = await supabase
        .from("client_payments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
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
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
      queryClient.invalidateQueries({ queryKey: ["overdue-payments"] });
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
