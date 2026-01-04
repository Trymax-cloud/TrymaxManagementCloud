import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCreateMeeting } from '@/hooks/useMeetings';
import { useAllUsers } from '@/hooks/useAllUsers';
import { useAuth } from '@/hooks/useAuth';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMeetingModal({ open, onOpenChange }: CreateMeetingModalProps) {
  const { user } = useAuth();
  const { data: users } = useAllUsers();
  const createMeeting = useCreateMeeting();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const availableParticipants = users?.filter(p => p.id !== user?.id) || [];

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const resetForm = () => {
    setTitle('');
    setNote('');
    setMeetingDate('');
    setMeetingTime('');
    setSelectedParticipants([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !meetingDate || !meetingTime || createMeeting.isPending) return;

    try {
      await createMeeting.mutateAsync({
        title: title.trim(),
        note: note.trim() || undefined,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        participant_ids: selectedParticipants
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule New Meeting</DialogTitle>
          <DialogDescription>
            Create a new meeting and invite participants.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time *</Label>
              <Input
                id="time"
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add meeting notes or agenda..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Participants</Label>
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedParticipants.map(id => {
                  const profile = users?.find(p => p.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {profile?.name || 'Unknown'}
                      <button
                        type="button"
                        onClick={() => toggleParticipant(id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <ScrollArea className="h-[150px] border rounded-md">
              <div className="p-2 space-y-1">
                {availableParticipants.map(profile => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => toggleParticipant(profile.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                      selectedParticipants.includes(profile.id)
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-accent"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium",
                      selectedParticipants.includes(profile.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      {selectedParticipants.includes(profile.id) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        getInitials(profile.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{profile.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                    </div>
                  </button>
                ))}
                {availableParticipants.length === 0 && (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    No users available
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMeeting.isPending}>
              {createMeeting.isPending ? 'Creating...' : 'Create Meeting'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
