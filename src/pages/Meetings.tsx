import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useMeetings, useDeleteMeeting, Meeting } from '@/hooks/useMeetings';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { CalendarDays, Clock, Plus, Users, Trash2, Edit } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateMeetingModal } from '@/components/meetings/CreateMeetingModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Meetings() {
  const { user } = useAuth();
  const { isDirector } = useUserRole();
  const { data: meetings, isLoading } = useMeetings();
  const deleteMeeting = useDeleteMeeting();
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const handleDelete = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedMeeting) {
      try {
        await deleteMeeting.mutateAsync(selectedMeeting.id);
        setDeleteDialogOpen(false);
        setSelectedMeeting(null);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const getMeetingDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const getMeetingStatus = (meeting: Meeting) => {
    const meetingDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_time}`);
    if (isPast(meetingDateTime)) return 'past';
    if (isToday(parseISO(meeting.meeting_date))) return 'today';
    return 'upcoming';
  };

  // Group meetings by date
  const groupedMeetings = meetings?.reduce((acc, meeting) => {
    const date = meeting.meeting_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>) || {};

  const sortedDates = Object.keys(groupedMeetings).sort();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
            <p className="text-muted-foreground">Schedule and manage your meetings</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Meeting
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : meetings?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No meetings scheduled</h3>
              <p className="text-muted-foreground mb-4">Create your first meeting to get started</p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {getMeetingDateLabel(date)}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({format(parseISO(date), 'MMMM d, yyyy')})
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {groupedMeetings[date].map(meeting => {
                    const status = getMeetingStatus(meeting);
                    const canEdit = meeting.created_by === user?.id || isDirector;
                    
                    return (
                      <Card 
                        key={meeting.id}
                        className={cn(
                          "transition-all",
                          status === 'past' && "opacity-60"
                        )}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">{meeting.title}</CardTitle>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {format(new Date(`2000-01-01T${meeting.meeting_time}`), 'h:mm a')}
                              </div>
                            </div>
                            <Badge 
                              variant={
                                status === 'today' ? 'default' : 
                                status === 'upcoming' ? 'secondary' : 
                                'outline'
                              }
                            >
                              {status === 'today' ? 'Today' : 
                               status === 'upcoming' ? 'Upcoming' : 
                               'Past'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {meeting.note && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {meeting.note}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                            <Users className="h-4 w-4" />
                            <span>
                              {meeting.participants?.length || 0} participant{(meeting.participants?.length || 0) !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {meeting.participants && meeting.participants.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {meeting.participants.slice(0, 3).map(p => (
                                <Badge key={p.id} variant="outline" className="text-xs">
                                  {p.user?.name || 'Unknown'}
                                </Badge>
                              ))}
                              {meeting.participants.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{meeting.participants.length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}

                          {canEdit && (
                            <div className="flex gap-2 pt-2 border-t">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(meeting)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateMeetingModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedMeeting?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
