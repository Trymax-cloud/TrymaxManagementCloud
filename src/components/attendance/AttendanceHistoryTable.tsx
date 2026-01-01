import { format, differenceInMinutes } from "date-fns";
import { Clock, Calendar } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAttendanceHistory, type Attendance } from "@/hooks/useAttendance";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AttendanceHistoryTableProps {
  startDate?: string;
  endDate?: string;
}

export function AttendanceHistoryTable({
  startDate,
  endDate,
}: AttendanceHistoryTableProps) {
  const { data: history, isLoading } = useAttendanceHistory(startDate, endDate);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge variant="default">Present</Badge>;
      case "absent":
        return <Badge variant="destructive">Absent</Badge>;
      case "half_day":
        return <Badge variant="secondary">Half Day</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDuration = (record: Attendance) => {
    if (!record.check_in || !record.check_out) return "-";
    const minutes = differenceInMinutes(
      new Date(record.check_out),
      new Date(record.check_in)
    );
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Attendance History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!history || history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No attendance records found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.date), "EEE, MMM d")}
                    </TableCell>
                    <TableCell>
                      {record.check_in
                        ? format(new Date(record.check_in), "hh:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {record.check_out
                        ? format(new Date(record.check_out), "hh:mm a")
                        : "-"}
                    </TableCell>
                    <TableCell>{getDuration(record)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {record.remarks || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
