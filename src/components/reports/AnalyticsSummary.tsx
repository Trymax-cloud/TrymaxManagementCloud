import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAnalyticsSummary, DateRange } from '@/hooks/useAnalyticsSummary';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Trophy,
  CreditCard,
  Users,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsSummaryProps {
  dateRange: DateRange;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

function TrendBadge({ 
  direction, 
  percentage, 
  label,
  positiveIsGood = true 
}: { 
  direction: 'up' | 'down' | 'stable'; 
  percentage: number;
  label: string;
  positiveIsGood?: boolean;
}) {
  const isPositive = direction === 'up';
  const isGood = positiveIsGood ? isPositive : !isPositive;
  
  return (
    <div className="flex items-center gap-1 text-xs">
      {direction === 'up' && <TrendingUp className={cn("h-3 w-3", isGood ? "text-green-500" : "text-red-500")} />}
      {direction === 'down' && <TrendingDown className={cn("h-3 w-3", isGood ? "text-green-500" : "text-red-500")} />}
      {direction === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
      <span className={cn(
        direction === 'stable' ? "text-muted-foreground" : isGood ? "text-green-600" : "text-red-600"
      )}>
        {direction === 'stable' ? 'No change' : `${percentage}% ${label}`}
      </span>
    </div>
  );
}

export function AnalyticsSummary({ dateRange }: AnalyticsSummaryProps) {
  const { data, isLoading, error } = useAnalyticsSummary(dateRange);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-destructive">Failed to load analytics summary</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Period Info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{data.period_label}</span>
        <span>•</span>
        <span>{data.comparison_label}</span>
      </div>

      {/* Task Analytics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Task Analytics
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                  <p className="text-3xl font-bold">{data.tasks.total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{data.tasks.completed}</p>
                  <TrendBadge 
                    direction={data.tasks_trend.direction} 
                    percentage={data.tasks_trend.change_percentage}
                    label="completion rate"
                  />
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-blue-600">{data.tasks.in_progress}</p>
                  <p className="text-xs text-muted-foreground">Pending: {data.tasks.pending}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-3xl font-bold text-red-600">{data.tasks.overdue}</p>
                  <p className="text-xs text-muted-foreground">Emergency: {data.tasks.emergency}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Completion Rate Bar */}
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Completion Rate</span>
              <span className="text-2xl font-bold">{data.tasks.completion_percentage}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${data.tasks.completion_percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Performance */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Employee Performance
        </h3>

        {/* Top Performer */}
        {data.top_performer && (
          <Card className="mb-4 border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Trophy className="h-7 w-7 text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{data.top_performer.employee_name}</p>
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700">
                      Top Performer
                    </Badge>
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{data.top_performer.tasks_completed} tasks completed</span>
                    <span>•</span>
                    <span>Score: {data.top_performer.productivity_score}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee List */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.employees.slice(0, 6).map((emp, index) => (
            <Card key={emp.employee_id} className={cn(index === 0 && "ring-1 ring-amber-500/30")}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                      index === 0 ? "bg-amber-500/20 text-amber-700" : "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{emp.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.tasks_completed} completed • {emp.overdue_tasks} overdue
                      </p>
                    </div>
                  </div>
                  <Badge variant={emp.productivity_score >= 50 ? "default" : emp.productivity_score >= 20 ? "secondary" : "outline"}>
                    {emp.productivity_score}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {data.employees.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No employee data for this period</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Analytics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Payment Analytics
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold">{data.payments.total_invoices}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(data.payments.total_invoice_amount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.payments.total_invoice_amount - data.payments.pending_amount)}
                </p>
                <TrendBadge 
                  direction={data.payments_trend.direction} 
                  percentage={data.payments_trend.change_percentage}
                  label="collection rate"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(data.payments.pending_amount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(data.payments.overdue_amount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.payments.overdue_count} payment{data.payments.overdue_count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Responsible Users with Pending */}
        {data.payments.responsible_users_with_pending.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Pending Follow-ups by User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.payments.responsible_users_with_pending.map(user => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{user.user_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.pending_count} pending payment{user.pending_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-600/50">
                      {formatCurrency(user.pending_amount)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
