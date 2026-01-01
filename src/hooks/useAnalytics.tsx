import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfMonth, endOfMonth, format, parseISO, isAfter } from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ProjectAnalytics {
  total_projects: number;
  by_stage: Record<string, number>;
  by_status: Record<string, number>;
  delayed_count: number;
  on_time_count: number;
  completion_rates: Array<{
    project_id: string;
    project_name: string;
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
  }>;
}

export interface EmployeeProductivity {
  employee_id: string;
  employee_name: string;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_in_progress: number;
  total_time_minutes: number;
  attendance_present: number;
  attendance_absent: number;
  attendance_half_day: number;
}

export interface PaymentAnalytics {
  total_invoice_amount: number;
  total_paid: number;
  total_due: number;
  overdue_count: number;
  overdue_amount: number;
  by_status: Record<string, { count: number; amount: number }>;
  overdue_payments: Array<{
    id: string;
    client_name: string;
    invoice_amount: number;
    amount_paid: number;
    due_date: string;
    days_overdue: number;
  }>;
}

export function useProjectAnalytics(dateRange: DateRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['project-analytics', user?.id, dateRange.from, dateRange.to],
    queryFn: async (): Promise<ProjectAnalytics> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .gte('created_at', fromDate)
        .lte('created_at', toDate + 'T23:59:59');

      if (projectsError) throw projectsError;

      // Get assignments for these projects
      const projectIds = projects?.map(p => p.id) || [];
      let assignments: any[] = [];
      
      if (projectIds.length > 0) {
        const { data, error } = await supabase
          .from('assignments')
          .select('*')
          .in('project_id', projectIds);
        
        if (error) throw error;
        assignments = data || [];
      }

      // Calculate by stage
      const byStage: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let delayedCount = 0;
      let onTimeCount = 0;
      const today = new Date();

      projects?.forEach(project => {
        byStage[project.stage] = (byStage[project.stage] || 0) + 1;
        byStatus[project.status] = (byStatus[project.status] || 0) + 1;

        // Check if delayed (end_date passed but not completed)
        if (project.end_date && project.status !== 'completed') {
          if (isAfter(today, parseISO(project.end_date))) {
            delayedCount++;
          } else {
            onTimeCount++;
          }
        } else if (project.status === 'completed') {
          onTimeCount++;
        }
      });

      // Calculate completion rates per project
      const completionRates = projects?.map(project => {
        const projectTasks = assignments.filter(a => a.project_id === project.id);
        const completedTasks = projectTasks.filter(a => a.status === 'completed').length;
        return {
          project_id: project.id,
          project_name: project.name,
          total_tasks: projectTasks.length,
          completed_tasks: completedTasks,
          completion_rate: projectTasks.length > 0 
            ? Math.round((completedTasks / projectTasks.length) * 100) 
            : 0
        };
      }) || [];

      return {
        total_projects: projects?.length || 0,
        by_stage: byStage,
        by_status: byStatus,
        delayed_count: delayedCount,
        on_time_count: onTimeCount,
        completion_rates: completionRates
      };
    },
    enabled: !!user?.id,
  });
}

export function useEmployeeProductivity(dateRange: DateRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['employee-productivity', user?.id, dateRange.from, dateRange.to],
    queryFn: async (): Promise<EmployeeProductivity[]> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email');

      if (profilesError) throw profilesError;

      // Get assignments in date range
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .gte('created_date', fromDate)
        .lte('created_date', toDate);

      if (assignmentsError) throw assignmentsError;

      // Get attendance in date range
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate);

      if (attendanceError) throw attendanceError;

      // Calculate productivity per employee
      return profiles?.map(profile => {
        const userAssignments = assignments?.filter(a => a.assignee_id === profile.id) || [];
        const userAttendance = attendance?.filter(a => a.user_id === profile.id) || [];

        return {
          employee_id: profile.id,
          employee_name: profile.name,
          tasks_assigned: userAssignments.length,
          tasks_completed: userAssignments.filter(a => a.status === 'completed').length,
          tasks_in_progress: userAssignments.filter(a => a.status === 'in_progress').length,
          total_time_minutes: userAssignments.reduce((sum, a) => sum + (a.total_duration_minutes || 0), 0),
          attendance_present: userAttendance.filter(a => a.status === 'present').length,
          attendance_absent: userAttendance.filter(a => a.status === 'absent').length,
          attendance_half_day: userAttendance.filter(a => a.status === 'half_day').length,
        };
      }) || [];
    },
    enabled: !!user?.id,
  });
}

export function usePaymentAnalytics(dateRange: DateRange) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payment-analytics', user?.id, dateRange.from, dateRange.to],
    queryFn: async (): Promise<PaymentAnalytics> => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      const today = new Date();

      const { data: payments, error } = await supabase
        .from('client_payments')
        .select('*')
        .gte('invoice_date', fromDate)
        .lte('invoice_date', toDate);

      if (error) throw error;

      let totalInvoice = 0;
      let totalPaid = 0;
      let overdueCount = 0;
      let overdueAmount = 0;
      const byStatus: Record<string, { count: number; amount: number }> = {};
      const overduePayments: PaymentAnalytics['overdue_payments'] = [];

      payments?.forEach(payment => {
        totalInvoice += Number(payment.invoice_amount);
        totalPaid += Number(payment.amount_paid);

        // By status
        if (!byStatus[payment.status]) {
          byStatus[payment.status] = { count: 0, amount: 0 };
        }
        byStatus[payment.status].count++;
        byStatus[payment.status].amount += Number(payment.invoice_amount);

        // Check overdue
        const dueDate = parseISO(payment.due_date);
        const remaining = Number(payment.invoice_amount) - Number(payment.amount_paid);
        
        if (isAfter(today, dueDate) && remaining > 0) {
          overdueCount++;
          overdueAmount += remaining;
          
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          overduePayments.push({
            id: payment.id,
            client_name: payment.client_name,
            invoice_amount: Number(payment.invoice_amount),
            amount_paid: Number(payment.amount_paid),
            due_date: payment.due_date,
            days_overdue: daysOverdue
          });
        }
      });

      // Sort overdue by days
      overduePayments.sort((a, b) => b.days_overdue - a.days_overdue);

      return {
        total_invoice_amount: totalInvoice,
        total_paid: totalPaid,
        total_due: totalInvoice - totalPaid,
        overdue_count: overdueCount,
        overdue_amount: overdueAmount,
        by_status: byStatus,
        overdue_payments: overduePayments
      };
    },
    enabled: !!user?.id,
  });
}
