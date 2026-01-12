import { useEffect, useRef } from 'react';
import { useOverduePayments } from './usePayments';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';
import { toast } from '@/hooks/use-toast';
import { showDesktopNotification } from '@/lib/desktopNotifications';
import { formatDistanceToNow } from 'date-fns';

export function useOverduePaymentReminders() {
  const { user, isLoading: authLoading } = useAuth();
  const { isDirector, isLoading: roleLoading } = useUserRole();
  const { data: overduePayments, isLoading: paymentsLoading } = useOverduePayments();
  const hasNotified = useRef(false);
  const lastNotificationTime = useRef(0);

  useEffect(() => {
    // Don't run until everything is loaded
    if (authLoading || roleLoading || paymentsLoading || !user) return;
    if (!overduePayments || overduePayments.length === 0) return;

    // Only notify once per session or every 4 hours
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;
    if (hasNotified.current && (now - lastNotificationTime.current) < fourHours) return;

    // Filter payments relevant to this user
    let relevantPayments = overduePayments;

    // If not a director, only show payments assigned to this user
    if (!isDirector) {
      relevantPayments = overduePayments.filter(p => p.responsible_user_id === user.id);
    }

    if (relevantPayments.length === 0) return;

    // Mark as notified
    hasNotified.current = true;
    lastNotificationTime.current = now;

    // Show summary notification
    const totalAmount = relevantPayments.reduce(
      (sum, p) => sum + (p.invoice_amount - p.amount_paid), 
      0
    );

    const title = `🚨 ${relevantPayments.length} Overdue Payment${relevantPayments.length > 1 ? 's' : ''}`;
    const message = `Total outstanding: ₹${totalAmount.toLocaleString('en-IN')}. Please follow up immediately.`;

    // Show in-app toast
    toast({
      title,
      description: message,
      variant: "destructive",
      duration: 15000,
    });

    // Show desktop notification
    showDesktopNotification(title, {
      body: message,
      tag: 'overdue-payments-summary',
      requireInteraction: true, // Keep notification until user interacts
    });

    // Show individual notifications for high-value overdue payments (> ₹50,000)
    const highValuePayments = relevantPayments.filter(
      p => (p.invoice_amount - p.amount_paid) > 50000
    );

    highValuePayments.slice(0, 3).forEach((payment, index) => {
      setTimeout(() => {
        const balance = payment.invoice_amount - payment.amount_paid;
        const overdueBy = formatDistanceToNow(new Date(payment.due_date), { addSuffix: false });

        showDesktopNotification(`⚠️ ${payment.client_name}`, {
          body: `₹${balance.toLocaleString('en-IN')} overdue by ${overdueBy}`,
          tag: `overdue-payment-${payment.id}`,
        });
      }, (index + 1) * 2000); // Stagger notifications by 2 seconds
    });

  }, [user, authLoading, roleLoading, paymentsLoading, overduePayments, isDirector]);
}
