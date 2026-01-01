import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  format, 
  parseISO, 
  isAfter, 
  differenceInDays,
  differenceInMinutes 
} from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface TaskSummary {
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
  overdue: number;
  emergency: number;
  completion_percentage: number;
}

export interface EmployeePerformance {
  employee_id: string;
  employee_name: string;
  tasks_completed: number;
  avg_completion_time_minutes: number;
  overdue_tasks: number;
  productivity_score: number;
}

export interface PaymentSummary {
  total_invoices: number;
  total_invoice_amount: number;
  pending_amount: number;
  overdue_amount: number;
  overdue_count: number;
  responsible_users_with_pending: Array<{
    user_id: string;
    user_name: string;
    pending_count: number;
    pending_amount: number;
  }>;
}

export interface TrendIndicator {
  current: number;
  previous: number;
  change_percentage: number;
  direction: 'up' | 'down' | 'stable';
}

export interface AnalyticsSummary {
  tasks: TaskSummary;
  tasks_trend: TrendIndicator;
  employees: EmployeePerformance[];
  top_performer: EmployeePerformance | null;
  payments: PaymentSummary;
  payments_trend: TrendIndicator;
  period_label: string;
  comparison_label: string;
}

export function useAnalyticsSummary(dateRange: DateRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics-summary', user?.id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async (): Promise<AnalyticsSummary> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      const today = new Date();

      // Calculate previous period (same duration before current period)
      const periodDays = differenceInDays(dateRange.to, dateRange.from);
      const prevFrom = subMonths(dateRange.from, 1);
      const prevTo = subMonths(dateRange.to, 1);
      const prevFromDate = format(prevFrom, 'yyyy-MM-dd');
      const prevToDate = format(prevTo, 'yyyy-MM-dd');

      // Fetch current period data
      const [assignmentsResult, prevAssignmentsResult, paymentsResult, prevPaymentsResult, profilesResult] = await Promise.all([
        supabase.from('assignments').select('*').gte('created_date', fromDate).lte('created_date', toDate),
        supabase.from('assignments').select('*').gte('created_date', prevFromDate).lte('created_date', prevToDate),
        supabase.from('client_payments').select('*').gte('invoice_date', fromDate).lte('invoice_date', toDate),
        supabase.from('client_payments').select('*').gte('invoice_date', prevFromDate).lte('invoice_date', prevToDate),
        supabase.from('profiles').select('id, name')
      ]);

      if (assignmentsResult.error) throw assignmentsResult.error;
      if (prevAssignmentsResult.error) throw prevAssignmentsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (prevPaymentsResult.error) throw prevPaymentsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const assignments = assignmentsResult.data || [];
      const prevAssignments = prevAssignmentsResult.data || [];
      const payments = paymentsResult.data || [];
      const prevPayments = prevPaymentsResult.data || [];
      const profiles = profilesResult.data || [];

      // Task Summary
      const completedTasks = assignments.filter(a => a.status === 'completed');
      const pendingTasks = assignments.filter(a => a.status === 'not_started');
      const inProgressTasks = assignments.filter(a => a.status === 'in_progress');
      const overdueTasks = assignments.filter(a => {
        if (a.status === 'completed') return false;
        if (!a.due_date) return false;
        return isAfter(today, parseISO(a.due_date));
      });
      const emergencyTasks = assignments.filter(a => a.priority === 'emergency');

      const tasksSummary: TaskSummary = {
        total: assignments.length,
        completed: completedTasks.length,
        pending: pendingTasks.length,
        in_progress: inProgressTasks.length,
        overdue: overdueTasks.length,
        emergency: emergencyTasks.length,
        completion_percentage: assignments.length > 0 
          ? Math.round((completedTasks.length / assignments.length) * 100) 
          : 0
      };

      // Task Trend (completion rate comparison)
      const prevCompleted = prevAssignments.filter(a => a.status === 'completed').length;
      const prevCompletionRate = prevAssignments.length > 0 
        ? Math.round((prevCompleted / prevAssignments.length) * 100) 
        : 0;
      
      const tasksTrend: TrendIndicator = calculateTrend(tasksSummary.completion_percentage, prevCompletionRate);

      // Employee Performance
      const employeePerformance: EmployeePerformance[] = profiles.map(profile => {
        const userTasks = assignments.filter(a => a.assignee_id === profile.id);
        const userCompleted = userTasks.filter(a => a.status === 'completed');
        const userOverdue = userTasks.filter(a => {
          if (a.status === 'completed') return false;
          if (!a.due_date) return false;
          return isAfter(today, parseISO(a.due_date));
        });

        // Calculate average completion time
        let totalCompletionMinutes = 0;
        let completedWithTime = 0;
        userCompleted.forEach(task => {
          if (task.total_duration_minutes && task.total_duration_minutes > 0) {
            totalCompletionMinutes += task.total_duration_minutes;
            completedWithTime++;
          }
        });

        const avgCompletionTime = completedWithTime > 0 
          ? Math.round(totalCompletionMinutes / completedWithTime) 
          : 0;

        // Productivity score: completed tasks * 10 - overdue tasks * 5
        const productivityScore = Math.max(0, (userCompleted.length * 10) - (userOverdue.length * 5));

        return {
          employee_id: profile.id,
          employee_name: profile.name,
          tasks_completed: userCompleted.length,
          avg_completion_time_minutes: avgCompletionTime,
          overdue_tasks: userOverdue.length,
          productivity_score: productivityScore
        };
      }).filter(e => e.tasks_completed > 0 || e.overdue_tasks > 0);

      // Sort by productivity score
      employeePerformance.sort((a, b) => b.productivity_score - a.productivity_score);

      // Top performer
      const topPerformer = employeePerformance.length > 0 ? employeePerformance[0] : null;

      // Payment Summary
      let totalInvoiceAmount = 0;
      let pendingAmount = 0;
      let overdueAmount = 0;
      let overdueCount = 0;
      const responsibleUserPending: Record<string, { count: number; amount: number }> = {};

      payments.forEach(payment => {
        const invoiceAmt = Number(payment.invoice_amount);
        const paidAmt = Number(payment.amount_paid);
        const remaining = invoiceAmt - paidAmt;

        totalInvoiceAmount += invoiceAmt;

        if (remaining > 0) {
          pendingAmount += remaining;
          
          // Track by responsible user
          if (!responsibleUserPending[payment.responsible_user_id]) {
            responsibleUserPending[payment.responsible_user_id] = { count: 0, amount: 0 };
          }
          responsibleUserPending[payment.responsible_user_id].count++;
          responsibleUserPending[payment.responsible_user_id].amount += remaining;

          // Check if overdue
          if (isAfter(today, parseISO(payment.due_date))) {
            overdueAmount += remaining;
            overdueCount++;
          }
        }
      });

      const responsibleUsersWithPending = Object.entries(responsibleUserPending).map(([userId, data]) => {
        const profile = profiles.find(p => p.id === userId);
        return {
          user_id: userId,
          user_name: profile?.name || 'Unknown',
          pending_count: data.count,
          pending_amount: data.amount
        };
      }).sort((a, b) => b.pending_amount - a.pending_amount);

      const paymentsSummary: PaymentSummary = {
        total_invoices: payments.length,
        total_invoice_amount: totalInvoiceAmount,
        pending_amount: pendingAmount,
        overdue_amount: overdueAmount,
        overdue_count: overdueCount,
        responsible_users_with_pending: responsibleUsersWithPending
      };

      // Payment Trend (collection rate comparison)
      const prevTotalInvoice = prevPayments.reduce((sum, p) => sum + Number(p.invoice_amount), 0);
      const prevTotalPaid = prevPayments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
      const currentCollectionRate = totalInvoiceAmount > 0 
        ? Math.round(((totalInvoiceAmount - pendingAmount) / totalInvoiceAmount) * 100) 
        : 0;
      const prevCollectionRate = prevTotalInvoice > 0 
        ? Math.round((prevTotalPaid / prevTotalInvoice) * 100) 
        : 0;

      const paymentsTrend: TrendIndicator = calculateTrend(currentCollectionRate, prevCollectionRate);

      return {
        tasks: tasksSummary,
        tasks_trend: tasksTrend,
        employees: employeePerformance,
        top_performer: topPerformer,
        payments: paymentsSummary,
        payments_trend: paymentsTrend,
        period_label: `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`,
        comparison_label: `vs ${format(prevFrom, 'MMM d')} - ${format(prevTo, 'MMM d')}`
      };
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });
}

function calculateTrend(current: number, previous: number): TrendIndicator {
  if (previous === 0) {
    return {
      current,
      previous,
      change_percentage: current > 0 ? 100 : 0,
      direction: current > 0 ? 'up' : 'stable'
    };
  }

  const change = ((current - previous) / previous) * 100;
  return {
    current,
    previous,
    change_percentage: Math.abs(Math.round(change)),
    direction: change > 2 ? 'up' : change < -2 ? 'down' : 'stable'
  };
}
