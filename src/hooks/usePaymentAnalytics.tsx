import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import type { ClientPayment } from "./usePayments";

export interface PaymentAnalytics {
  totalInvoiced: number;
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  collectionRate: number;
  averagePaymentDelay: number;
  paymentsThisMonth: number;
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
}

export interface PaymentTrend {
  month: string;
  invoiced: number;
  received: number;
}

export interface ClientPaymentSummary {
  clientName: string;
  totalInvoiced: number;
  totalPaid: number;
  pendingAmount: number;
  overdueAmount: number;
  paymentCount: number;
  averagePaymentDelay: number;
}

// Hook to get payment analytics
export function usePaymentAnalytics() {
  const { user } = useAuth();
  const { isDirector } = useUserRole();

  return useQuery({
    queryKey: ["payment-analytics"],
    queryFn: async () => {
      let query = supabase.from("client_payments").select("*");
      
      // Filter by role: Directors see all, Employees see only their responsible payments
      if (!isDirector) {
        query = query.eq("responsible_user_id", user!.id);
      }
      
      const { data: payments, error } = await query;

      if (error) throw error;

      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const totalInvoiced = payments.reduce((sum, p) => sum + Number(p.invoice_amount), 0);
      const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
      
      // Calculate pending amounts correctly - only for unpaid and partially paid payments
      const pendingPayments = payments.filter((p) => p.status === "pending" || p.status === "partially_paid");
      const totalPending = pendingPayments.reduce((sum, p) => sum + (Number(p.invoice_amount) - Number(p.amount_paid)), 0);

      const overduePayments = payments.filter(
        (p) => new Date(p.due_date) < now && p.status !== "paid"
      );
      const totalOverdue = overduePayments.reduce(
        (sum, p) => sum + (Number(p.invoice_amount) - Number(p.amount_paid)),
        0
      );

      // Calculate average payment delay (for paid payments)
      const paidPayments = payments.filter((p) => p.status === "paid");
      let averageDelay = 0;
      if (paidPayments.length > 0) {
        const totalDelay = paidPayments.reduce((sum, p) => {
          const dueDate = new Date(p.due_date);
          const paidDate = new Date(p.updated_at);
          const delay = Math.max(0, Math.ceil((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          return sum + delay;
        }, 0);
        averageDelay = Math.round(totalDelay / paidPayments.length);
      }

      // Payments this month
      const paymentsThisMonth = payments.filter((p) =>
        p.invoice_date.startsWith(thisMonth)
      ).length;

      const analytics: PaymentAnalytics = {
        totalInvoiced,
        totalReceived,
        totalPending,
        totalOverdue,
        collectionRate: totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0,
        averagePaymentDelay: averageDelay,
        paymentsThisMonth,
        pendingCount: payments.filter((p) => p.status === "pending" || p.status === "partially_paid").length,
        overdueCount: overduePayments.length,
        paidCount: paidPayments.length,
      };

      return analytics;
    },
    enabled: !!user,
  });
}

// Hook to get payment trends (last 6 months)
export function usePaymentTrends() {
  const { user } = useAuth();
  const { isDirector } = useUserRole();

  return useQuery({
    queryKey: ["payment-trends"],
    queryFn: async () => {
      let query = supabase.from("client_payments").select("*").order("invoice_date", { ascending: true });
      
      // Filter by role: Directors see all, Employees see only their responsible payments
      if (!isDirector) {
        query = query.eq("responsible_user_id", user!.id);
      }
      
      const { data: payments, error } = await query;

      if (error) throw error;

      // Get last 6 months
      const now = new Date();
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      }

      const trends: PaymentTrend[] = months.map((month) => {
        const monthPayments = payments.filter((p) => p.invoice_date.startsWith(month));
        return {
          month,
          invoiced: monthPayments.reduce((sum, p) => sum + Number(p.invoice_amount), 0),
          received: monthPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0),
        };
      });

      return trends;
    },
    enabled: !!user,
  });
}

// Hook to get client payment summaries
export function useClientPaymentSummaries() {
  const { user } = useAuth();
  const { isDirector } = useUserRole();

  return useQuery({
    queryKey: ["client-payment-summaries"],
    queryFn: async () => {
      let query = supabase.from("client_payments").select("*");
      
      // Filter by role: Directors see all, Employees see only their responsible payments
      if (!isDirector) {
        query = query.eq("responsible_user_id", user!.id);
      }
      
      const { data: payments, error } = await query;

      if (error) throw error;

      const now = new Date();
      const clientMap: Record<string, ClientPayment[]> = {};

      payments.forEach((p) => {
        if (!clientMap[p.client_name]) {
          clientMap[p.client_name] = [];
        }
        clientMap[p.client_name].push(p as ClientPayment);
      });

      const summaries: ClientPaymentSummary[] = Object.entries(clientMap).map(
        ([clientName, clientPayments]) => {
          const totalInvoiced = clientPayments.reduce((sum, p) => sum + Number(p.invoice_amount), 0);
          const totalPaid = clientPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
          
          // Calculate pending amount correctly - only for unpaid and partially paid payments
          const pendingPayments = clientPayments.filter((p) => p.status === "pending" || p.status === "partially_paid");
          const pendingAmount = pendingPayments.reduce((sum, p) => sum + (Number(p.invoice_amount) - Number(p.amount_paid)), 0);
          
          const overduePayments = clientPayments.filter(
            (p) => new Date(p.due_date) < now && p.status !== "paid"
          );
          const overdueAmount = overduePayments.reduce(
            (sum, p) => sum + (Number(p.invoice_amount) - Number(p.amount_paid)),
            0
          );

          // Average payment delay for paid payments
          const paidPayments = clientPayments.filter((p) => p.status === "paid");
          let avgDelay = 0;
          if (paidPayments.length > 0) {
            const totalDelay = paidPayments.reduce((sum, p) => {
              const dueDate = new Date(p.due_date);
              const paidDate = new Date(p.updated_at);
              return sum + Math.max(0, Math.ceil((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
            }, 0);
            avgDelay = Math.round(totalDelay / paidPayments.length);
          }

          return {
            clientName,
            totalInvoiced,
            totalPaid,
            pendingAmount: totalInvoiced - totalPaid,
            overdueAmount,
            paymentCount: clientPayments.length,
            averagePaymentDelay: avgDelay,
          };
        }
      );

      // Sort by pending amount descending
      return summaries.sort((a, b) => b.pendingAmount - a.pendingAmount);
    },
    enabled: !!user,
  });
}

// Hook to get upcoming payment reminders
export function useUpcomingPaymentReminders(daysAhead: number = 7) {
  const { user } = useAuth();
  const { isDirector } = useUserRole();

  return useQuery({
    queryKey: ["upcoming-payment-reminders", daysAhead],
    queryFn: async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      const todayStr = now.toISOString().split("T")[0];
      const futureDateStr = futureDate.toISOString().split("T")[0];

      let query = supabase
        .from("client_payments")
        .select("*")
        .in("status", ["pending", "partially_paid"])
        .gte("due_date", todayStr)
        .lte("due_date", futureDateStr)
        .order("due_date", { ascending: true });
      
      // Filter by role: Directors see all, Employees see only their responsible payments
      if (!isDirector) {
        query = query.eq("responsible_user_id", user!.id);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      return data as ClientPayment[];
    },
    enabled: !!user,
  });
}
