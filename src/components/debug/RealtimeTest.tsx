import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export function RealtimeTest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[RealtimeTest] ${message}`);
  };

  useEffect(() => {
    if (!user?.id) return;

    addLog(`Setting up test subscription for user: ${user.id}`);

    const channel = supabase
      .channel("test-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
        },
        (payload) => {
          const title = (payload.new as any)?.title || (payload.old as any)?.title || 'unknown';
          const id = (payload.new as any)?.id || (payload.old as any)?.id || 'unknown';
          addLog(`📨 Received: ${payload.eventType} - ${title} (${id})`);
        }
      )
      .subscribe((status) => {
        addLog(`🔌 Subscription status: ${status}`);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          toast.success("Realtime test connected successfully!");
        } else if (status === 'CHANNEL_ERROR') {
          toast.error("Realtime test failed to connect");
        }
      });

    return () => {
      addLog("🧹 Cleaning up test subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const testInsert = async () => {
    try {
      addLog("🧪 Testing insert...");
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          title: `Test Assignment ${Date.now()}`,
          assignee_id: user?.id || '',
          creator_id: user?.id || '',
          description: "Realtime test assignment",
          priority: "normal",
          category: "general",
        })
        .select()
        .single();

      if (error) {
        addLog(`❌ Insert failed: ${error.message}`);
        toast.error(`Insert failed: ${error.message}`);
      } else {
        addLog(`✅ Insert successful: ${data.id}`);
        toast.success("Test assignment created");
      }
    } catch (error) {
      addLog(`❌ Insert error: ${error}`);
      toast.error(`Insert error: ${error}`);
    }
  };

  const testInvalidation = () => {
    addLog("🔄 Testing query invalidation...");
    queryClient.invalidateQueries({ queryKey: ["assignments-with-profiles"] });
    addLog("✅ Invalidated assignments-with-profiles queries");
    toast.success("Query invalidation test completed");
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          Realtime Test Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={testInsert} disabled={!isConnected}>
            Test Insert Assignment
          </Button>
          <Button onClick={testInvalidation} variant="outline">
            Test Query Invalidation
          </Button>
          <Button variant="outline" onClick={clearLogs}>
            Clear Logs
          </Button>
        </div>
        
        <div className="text-sm">
          <p className="font-medium">Connection Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
          <p className="text-muted-foreground">User: {user?.email}</p>
        </div>

        <div className="bg-muted rounded-md p-3 h-64 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={index % 2 === 0 ? 'bg-background' : ''}>
                {log}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
