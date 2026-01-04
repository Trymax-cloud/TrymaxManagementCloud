import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  useConversations, 
  useConversationMessages, 
  useSendMessage,
  useMarkMessagesAsRead,
  Conversation 
} from '@/hooks/useMessages';
import { useAllUsers } from '@/hooks/useAllUsers';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Send, ArrowLeft, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function Messages() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { data: messages, isLoading: messagesLoading } = useConversationMessages(selectedUserId);
  const { data: users } = useAllUsers();
  const sendMessage = useSendMessage();
  const markAsRead = useMarkMessagesAsRead();

  const selectedConversation = conversations?.find(c => c.user_id === selectedUserId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when selecting a conversation
  useEffect(() => {
    if (selectedUserId) {
      markAsRead.mutate(selectedUserId);
    }
  }, [selectedUserId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !messageInput.trim()) return;

    await sendMessage.mutateAsync({
      receiverId: selectedUserId,
      content: messageInput.trim()
    });
    setMessageInput('');
  };

  const handleStartNewChat = (userId: string) => {
    setSelectedUserId(userId);
    setNewChatOpen(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter out current user from profiles for new chat
  const availableUsers = users?.filter(p => p.id !== user?.id) || [];

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Conversations List */}
        <Card className={cn(
          "w-full md:w-80 flex-shrink-0 flex flex-col",
          selectedUserId && "hidden md:flex"
        )}>
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
              <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Users className="h-4 w-4 mr-1" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start New Conversation</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {availableUsers.map(profile => (
                        <button
                          key={profile.id}
                          onClick={() => handleStartNewChat(profile.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {getInitials(profile.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{profile.name}</p>
                            <p className="text-sm text-muted-foreground">{profile.email}</p>
                          </div>
                        </button>
                      ))}
                      {availableUsers.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No users available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {conversationsLoading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
              </div>
            ) : conversations?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start a new chat!</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {conversations?.map((conv: Conversation) => (
                    <button
                      key={conv.user_id}
                      onClick={() => setSelectedUserId(conv.user_id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                        selectedUserId === conv.user_id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-accent"
                      )}
                    >
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {getInitials(conv.user_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{conv.user_name}</p>
                          {conv.unread_count > 0 && (
                            <Badge variant="default" className="ml-2 h-5 min-w-[20px] flex items-center justify-center">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.last_message}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className={cn(
          "flex-1 flex flex-col",
          !selectedUserId && "hidden md:flex"
        )}>
          {selectedUserId ? (
            <>
              <CardHeader className="flex-shrink-0 pb-3 border-b">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSelectedUserId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {selectedConversation ? getInitials(selectedConversation.user_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {selectedConversation?.user_name || users?.find(p => p.id === selectedUserId)?.name || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation?.user_email || users?.find(p => p.id === selectedUserId)?.email}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <LoadingSpinner />
                    </div>
                  ) : messages?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Start the conversation!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages?.map(msg => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.sender_id === user?.id ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] rounded-lg px-4 py-2",
                              msg.sender_id === user?.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="break-words">{msg.content}</p>
                            <p className={cn(
                              "text-xs mt-1",
                              msg.sender_id === user?.id
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}>
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              <div className="flex-shrink-0 p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!messageInput.trim() || sendMessage.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose from the list or start a new chat</p>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
