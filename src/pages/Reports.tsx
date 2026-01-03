import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  useProjectAnalytics, 
  useEmployeeProductivity, 
  usePaymentAnalytics,
  DateRange 
} from '@/hooks/useAnalytics';
import { AnalyticsSummary } from '@/components/reports/AnalyticsSummary';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  Download, 
  FileSpreadsheet, 
  Calendar,
  TrendingUp,
  Users,
  CreditCard,
  FolderKanban,
  AlertTriangle,
  LayoutDashboard
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const STAGE_LABELS: Record<string, string> = {
  order_received: 'Order Received',
  inspection: 'Inspection',
  dispatch: 'Dispatch',
  delivery: 'Delivery'
};

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  }));
  const [rangePreset, setRangePreset] = useState('this_month');

  const { data: projectData, isLoading: projectLoading } = useProjectAnalytics(dateRange);
  const { data: employeeData, isLoading: employeeLoading } = useEmployeeProductivity(dateRange);
  const { data: paymentData, isLoading: paymentLoading } = usePaymentAnalytics(dateRange);

  const handleRangeChange = (value: string) => {
    setRangePreset(value);
    const now = new Date();
    
    switch (value) {
      case 'this_month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case 'last_3_months':
        setDateRange({ from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) });
        break;
      case 'last_6_months':
        setDateRange({ from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) });
        break;
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Prepare chart data
  const stageChartData = projectData ? Object.entries(projectData.by_stage).map(([key, value]) => ({
    name: STAGE_LABELS[key] || key,
    value
  })) : [];

  const projectStatusData = projectData ? [
    { name: 'On Time', value: projectData.on_time_count },
    { name: 'Delayed', value: projectData.delayed_count }
  ].filter(d => d.value > 0) : [];

  const paymentStatusData = paymentData ? [
    { name: 'Paid', value: paymentData.total_paid },
    { name: 'Due', value: paymentData.total_due }
  ] : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics & Reports</h1>
            <p className="text-muted-foreground">
              {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={rangePreset} onValueChange={handleRangeChange}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                <SelectItem value="last_6_months">Last 6 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderKanban className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              Productivity
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <AnalyticsSummary dateRange={dateRange} />
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4">
            {projectLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{projectData?.total_projects || 0}</div>
                      <p className="text-sm text-muted-foreground">Total Projects</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{projectData?.on_time_count || 0}</div>
                      <p className="text-sm text-muted-foreground">On Time</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{projectData?.delayed_count || 0}</div>
                      <p className="text-sm text-muted-foreground">Delayed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {projectData?.completion_rates && projectData.completion_rates.length > 0
                          ? Math.round(projectData.completion_rates.reduce((sum, p) => sum + p.completion_rate, 0) / projectData.completion_rates.length)
                          : 0}%
                      </div>
                      <p className="text-sm text-muted-foreground">Avg Completion</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Projects by Stage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stageChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={stageChartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No data</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">On-Time vs Delayed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {projectStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={projectStatusData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {projectStatusData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Completion Table */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Project Completion Rates</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => exportToCSV(projectData?.completion_rates || [], 'project_completion')}
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Total Tasks</TableHead>
                          <TableHead className="text-right">Completed</TableHead>
                          <TableHead className="text-right">Completion %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectData?.completion_rates.map(project => (
                          <TableRow key={project.project_id}>
                            <TableCell className="font-medium">{project.project_name}</TableCell>
                            <TableCell className="text-right">{project.total_tasks}</TableCell>
                            <TableCell className="text-right">{project.completed_tasks}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={project.completion_rate >= 80 ? 'default' : project.completion_rate >= 50 ? 'secondary' : 'outline'}>
                                {project.completion_rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!projectData?.completion_rates || projectData.completion_rates.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No projects found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            {employeeLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Employee Productivity</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportToCSV(employeeData || [], 'employee_productivity')}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Assigned</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">In Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeData?.map(emp => (
                        <TableRow key={emp.employee_id}>
                          <TableCell className="font-medium">{emp.employee_name}</TableCell>
                          <TableCell className="text-right">{emp.tasks_assigned}</TableCell>
                          <TableCell className="text-right text-green-600">{emp.tasks_completed}</TableCell>
                          <TableCell className="text-right text-blue-600">{emp.tasks_in_progress}</TableCell>
                        </TableRow>
                      ))}
                      {(!employeeData || employeeData.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No employees found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            {paymentLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{formatCurrency(paymentData?.total_invoice_amount || 0)}</div>
                      <p className="text-sm text-muted-foreground">Total Invoice</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(paymentData?.total_paid || 0)}</div>
                      <p className="text-sm text-muted-foreground">Received</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-amber-600">{formatCurrency(paymentData?.total_due || 0)}</div>
                      <p className="text-sm text-muted-foreground">Due</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{formatCurrency(paymentData?.overdue_amount || 0)}</div>
                      <p className="text-sm text-muted-foreground">Overdue ({paymentData?.overdue_count || 0})</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Payment Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Payment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {paymentStatusData.some(d => d.value > 0) ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={paymentStatusData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                          >
                            <Cell fill="hsl(142, 76%, 36%)" />
                            <Cell fill="hsl(38, 92%, 50%)" />
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No payment data</p>
                    )}
                  </CardContent>
                </Card>

                {/* Overdue Table */}
                {(paymentData?.overdue_payments?.length || 0) > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Overdue Payments
                      </CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => exportToCSV(paymentData?.overdue_payments || [], 'overdue_payments')}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead className="text-right">Invoice</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Remaining</TableHead>
                            <TableHead className="text-right">Due Date</TableHead>
                            <TableHead className="text-right">Days Overdue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentData?.overdue_payments.map(payment => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">{payment.client_name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(payment.invoice_amount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(payment.amount_paid)}</TableCell>
                              <TableCell className="text-right text-red-600">
                                {formatCurrency(payment.invoice_amount - payment.amount_paid)}
                              </TableCell>
                              <TableCell className="text-right">{format(new Date(payment.due_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="destructive">{payment.days_overdue} days</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
