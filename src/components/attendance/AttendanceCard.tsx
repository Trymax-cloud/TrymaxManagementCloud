import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { Clock, LogIn, LogOut, Coffee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useTodayAttendance,
  useCheckIn,
  useCheckOut,
} from "@/hooks/useAttendance";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function AttendanceCard() {
  const { data: todayAttendance, isLoading } = useTodayAttendance();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const hasCheckedIn = !!todayAttendance?.check_in;
  const hasCheckedOut = !!todayAttendance?.check_out;

  // Calculate work duration
  const getWorkDuration = () => {
    if (!todayAttendance?.check_in) return null;
    
    const checkInTime = new Date(todayAttendance.check_in);
    const endTime = todayAttendance.check_out
      ? new Date(todayAttendance.check_out)
      : new Date();

    const totalMinutes = differenceInMinutes(endTime, checkInTime);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours, minutes, totalMinutes };
  };

  const duration = getWorkDuration();

  if (isLoading) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Today's Attendance
          </span>
          <Badge
            variant={
              hasCheckedOut
                ? "secondary"
                : hasCheckedIn
                ? "default"
                : "outline"
            }
          >
            {hasCheckedOut
              ? "Completed"
              : hasCheckedIn
              ? "Working"
              : "Not Started"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Check In
            </p>
            <p className="text-lg font-semibold">
              {todayAttendance?.check_in
                ? format(new Date(todayAttendance.check_in), "hh:mm a")
                : "--:--"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Check Out
            </p>
            <p className="text-lg font-semibold">
              {todayAttendance?.check_out
                ? format(new Date(todayAttendance.check_out), "hh:mm a")
                : "--:--"}
            </p>
          </div>
        </div>

        {/* Duration */}
        {duration && (
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {hasCheckedOut ? "Total Work Time" : "Time Elapsed"}
            </p>
            <p className="text-2xl font-bold text-primary">
              {duration.hours}h {duration.minutes}m
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!hasCheckedIn ? (
            <Button
              className="flex-1 gap-2"
              onClick={() => checkIn.mutate()}
              disabled={checkIn.isPending}
            >
              {checkIn.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Check In
            </Button>
          ) : !hasCheckedOut ? (
            <Button
              className="flex-1 gap-2"
              variant="secondary"
              onClick={() => checkOut.mutate()}
              disabled={checkOut.isPending}
            >
              {checkOut.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Check Out
            </Button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground py-2">
              <Coffee className="h-4 w-4" />
              <span className="text-sm">Day completed. Great work!</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
