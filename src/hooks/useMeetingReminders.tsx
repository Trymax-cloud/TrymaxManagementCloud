import { useEffect, useRef } from 'react';
import { useUpcomingMeetings } from './useMeetings';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, differenceInMinutes, isToday } from 'date-fns';
import { showDesktopNotification } from '@/lib/desktopNotifications';

export function useMeetingReminders() {
  const { user, isLoading } = useAuth();
  const { data: meetings, isLoading: meetingsLoading } = useUpcomingMeetings();
  const notifiedMeetings = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isLoading || !user || meetingsLoading) return;
    if (!meetings || meetings.length === 0) return;

    const checkReminders = () => {
      const now = new Date();

      meetings.forEach(meeting => {
        if (!isToday(parseISO(meeting.meeting_date))) return;

        const meetingDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_time}`);
        const minutesUntilMeeting = differenceInMinutes(meetingDateTime, now);

        // Remind 1 hour (60 minutes) before
        if (minutesUntilMeeting <= 60 && minutesUntilMeeting > 59) {
          const reminderId = `${meeting.id}-60`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            const message = `"${meeting.title}" starts in 1 hour at ${format(meetingDateTime, 'h:mm a')}`;
            
            toast({
              title: '📅 Meeting in 1 Hour',
              description: message,
              duration: 10000,
            });
            
            showDesktopNotification('📅 Meeting in 1 Hour', {
              body: message,
              tag: reminderId,
            });
          }
        }

        // Remind 15 minutes before
        if (minutesUntilMeeting <= 15 && minutesUntilMeeting > 0) {
          const reminderId = `${meeting.id}-15`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            const message = `"${meeting.title}" starts in ${minutesUntilMeeting} minutes at ${format(meetingDateTime, 'h:mm a')}`;
            
            toast({
              title: '📅 Meeting Reminder',
              description: message,
              duration: 10000,
            });
            
            showDesktopNotification('📅 Meeting Reminder', {
              body: message,
              tag: reminderId,
            });
          }
        }

        // Remind at meeting time
        if (minutesUntilMeeting <= 0 && minutesUntilMeeting > -1) {
          const reminderId = `${meeting.id}-now`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            const message = `"${meeting.title}" is starting now!`;
            
            toast({
              title: '🔔 Meeting Starting Now',
              description: message,
              duration: 15000,
            });
            
            showDesktopNotification('🔔 Meeting Starting Now', {
              body: message,
              tag: reminderId,
            });
          }
        }
      });
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [user, isLoading, meetings, meetingsLoading]);
}
