import { useState, useEffect } from "react";
import { Play, Pause, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useStartTimeTracking,
  useStopTimeTracking,
  useResetTimeTracking,
  formatDuration,
} from "@/hooks/useAssignmentTimeTracking";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { differenceInMinutes } from "date-fns";

interface TimeTrackingControlsProps {
  assignmentId: string;
  startTime: string | null;
  endTime: string | null;
  totalDurationMinutes: number | null;
  status: string;
}

export function TimeTrackingControls({
  assignmentId,
  startTime,
  endTime,
  totalDurationMinutes,
  status,
}: TimeTrackingControlsProps) {
  const startTracking = useStartTimeTracking();
  const stopTracking = useStopTimeTracking();
  const resetTracking = useResetTimeTracking();

  const [elapsedTime, setElapsedTime] = useState(0);

  const isTracking = !!startTime && !endTime;
  const isCompleted = status === "completed";

  // Update elapsed time every minute when tracking
  useEffect(() => {
    if (!isTracking || !startTime) return;

    const updateElapsed = () => {
      const minutes = differenceInMinutes(new Date(), new Date(startTime));
      setElapsedTime(minutes);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isTracking, startTime]);

  const handleStart = () => {
    startTracking.mutate(assignmentId);
  };

  const handleStop = () => {
    if (startTime) {
      stopTracking.mutate({ assignmentId, startTime });
    }
  };

  const handleReset = () => {
    resetTracking.mutate(assignmentId);
  };

  if (isCompleted) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Total: {formatDuration(totalDurationMinutes)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isTracking ? (
        <>
          <Badge variant="default" className="animate-pulse gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(elapsedTime)}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 w-8 p-0"
                onClick={handleStop}
                disabled={stopTracking.isPending}
              >
                {stopTracking.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop Timer</TooltipContent>
          </Tooltip>
        </>
      ) : (
        <>
          {totalDurationMinutes ? (
            <span className="text-xs text-muted-foreground">
              Total: {formatDuration(totalDurationMinutes)}
            </span>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={handleStart}
                disabled={startTracking.isPending}
              >
                {startTracking.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start Timer</TooltipContent>
          </Tooltip>
          {endTime && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={handleReset}
                  disabled={resetTracking.isPending}
                >
                  {resetTracking.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset Session</TooltipContent>
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}
