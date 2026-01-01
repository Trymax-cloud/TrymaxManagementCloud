import { useEffect, useRef } from 'react';
import { useUpcomingMeetings } from './useMeetings';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, differenceInMinutes, isToday } from 'date-fns';

export function useMeetingReminders() {
  const { data: meetings } = useUpcomingMeetings();
  const notifiedMeetings = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!meetings || meetings.length === 0) return;

    const checkReminders = () => {
      const now = new Date();

      meetings.forEach(meeting => {
        // Only check today's meetings
        if (!isToday(parseISO(meeting.meeting_date))) return;

        const meetingDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_time}`);
        const minutesUntilMeeting = differenceInMinutes(meetingDateTime, now);

        // Remind 15 minutes before
        if (minutesUntilMeeting <= 15 && minutesUntilMeeting > 0) {
          const reminderId = `${meeting.id}-15`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            toast({
              title: '📅 Meeting Reminder',
              description: `"${meeting.title}" starts in ${minutesUntilMeeting} minutes at ${format(meetingDateTime, 'h:mm a')}`,
              duration: 10000,
            });
          }
        }

        // Remind at meeting time
        if (minutesUntilMeeting <= 0 && minutesUntilMeeting > -1) {
          const reminderId = `${meeting.id}-now`;
          if (!notifiedMeetings.current.has(reminderId)) {
            notifiedMeetings.current.add(reminderId);
            toast({
              title: '🔔 Meeting Starting Now',
              description: `"${meeting.title}" is starting now!`,
              duration: 15000,
            });
          }
        }
      });
    };

    // Check immediately and then every minute
    checkReminders();
    const interval = setInterval(checkReminders, 60000);

    return () => clearInterval(interval);
  }, [meetings]);
}
