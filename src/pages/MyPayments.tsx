import { useState } from "react";
import { format, isPast, isToday, addDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyPayments, useUpdatePayment } from "@/hooks/usePayments";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { 
  CalendarDays, Mail, AlertTriangle, CheckCircle, Clock, AlertCircle, CheckCircle2, Filter, CreditCard, 
  DollarSign, TrendingUp, Eye, Edit, RefreshCw
} from "lucide-react";
import { ClientPayment } from "@/hooks/usePayments";

export default function MyPayments() {
  const { user } = useAuth();
  const { data: payments, isLoading } = useMyPayments();
  const { data: projects } = useProjects();
  const updatePayment = useUpdatePayment();
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return undefined;
    return projects?.find(p => p.id === projectId)?.name;
  };

  const filteredPayments = payments?.filter(payment => {
    const matchesSearch = 
      payment.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getProjectName(payment.project_id)?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const today = new Date();
  const totalPending = payments?.filter(p => p.status === "pending").length || 0;
  const totalPartiallyPaid = payments?.filter(p => p.status === "partially_paid").length || 0;
  const totalPaid = payments?.filter(p => p.status === "paid").length || 0;
  const totalOverdue = payments?.filter(p => 
    p.status !== "paid" && isPast(new Date(p.due_date))
  ).length || 0;
  const totalAmount = payments?.reduce((acc, p) => acc + p.invoice_amount, 0) || 0;
  const totalPaidAmount = payments?.reduce((acc, p) => acc + p.amount_paid, 0) || 0;
  const totalPendingAmount = totalAmount - totalPaidAmount;

  // Upcoming payments (next 7 days)
  const upcomingPayments = payments?.filter(p => 
    p.status !== "paid" && 
    !isPast(new Date(p.due_date)) && 
    new Date(p.due_date) <= addDays(today, 7)
  ).length || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleStatusUpdate = async (payment: ClientPayment, newStatus: ClientPayment["status"], amountPaid?: number) => {
    try {
      console.log("🔄 Updating payment:", {
        id: payment.id,
        currentStatus: payment.status,
        newStatus,
        currentAmountPaid: payment.amount_paid,
        newAmountPaid: amountPaid || payment.amount_paid,
        invoiceAmount: payment.invoice_amount
      });
      
      await updatePayment.mutateAsync({
        id: payment.id,
        status: newStatus,
        amount_paid: amountPaid || payment.amount_paid,
      });
      
      console.log("✅ Payment updated successfully");
    } catch (error) {
      console.error("❌ Failed to update payment:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update payment status. Please try again.",
      });
    }
  };

  const handleQuickStatusUpdate = async (payment: ClientPayment, newStatus: ClientPayment["status"]) => {
    if (newStatus === "paid") {
      // Mark as fully paid
      await handleStatusUpdate(payment, newStatus, payment.invoice_amount);
    } else {
      await handleStatusUpdate(payment, newStatus);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "partially_paid": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getPaymentCard = (payment: ClientPayment) => {
    const isOverdue = payment.status !== "paid" && isPast(new Date(payment.due_date));
    const isDueSoon = !isOverdue && payment.status !== "paid" && 
      new Date(payment.due_date) <= addDays(today, 3);
    
    return (
      <Card className={`border-0 shadow-soft transition-all duration-200 hover:shadow-md ${
        isOverdue ? 'border-l-4 border-l-red-500' : 
        isDueSoon ? 'border-l-4 border-l-yellow-500' : ''
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg font-semibold">{payment.client_name}</CardTitle>
              {getProjectName(payment.project_id) && (
                <CardDescription className="text-sm">
                  Project: {getProjectName(payment.project_id)}
                </CardDescription>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={getStatusColor(payment.status)}>
                {payment.status.replace('_', ' ').toUpperCase()}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  OVERDUE
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Invoice Amount:</span>
              <p className="font-semibold">{formatCurrency(payment.invoice_amount)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Amount Paid:</span>
              <p className="font-semibold">{formatCurrency(payment.amount_paid)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Due Date:</span>
              <p className={`font-medium ${
                isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : ''
              }`}>
                {format(new Date(payment.due_date), "MMM dd, yyyy")}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Invoice Date:</span>
              <p className="font-medium">{format(new Date(payment.invoice_date), "MMM dd, yyyy")}</p>
            </div>
          </div>
          
          {payment.remarks && (
            <div>
              <span className="text-muted-foreground text-sm">Remarks:</span>
              <p className="text-sm mt-1">{payment.remarks}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {payment.status !== "paid" && (
              <Button
                size="sm"
                onClick={() => handleQuickStatusUpdate(payment, "paid")}
                className="flex items-center gap-2"
                disabled={updatePayment.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                Mark Paid
              </Button>
            )}
            
            {payment.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuickStatusUpdate(payment, "partially_paid")}
                className="flex items-center gap-2"
                disabled={updatePayment.isPending}
              >
                <RefreshCw className="h-4 w-4" />
                Partial Payment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout title="My Payments">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Payments</h1>
          <p className="text-muted-foreground">
            Manage payment follow-ups assigned to you
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">All Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Assigned</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">{totalPending}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Overdue</p>
                      <p className="text-2xl font-bold">{totalOverdue}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paid</p>
                      <p className="text-2xl font-bold">{totalPaid}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-0 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Overdue Payments
                  </CardTitle>
                  <CardDescription>
                    Payments that require immediate attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {payments?.filter(p => p.status !== "paid" && isPast(new Date(p.due_date)))
                      .slice(0, 3)
                      .map(payment => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div>
                            <p className="font-medium">{payment.client_name}</p>
                            <p className="text-sm text-red-600">
                              Due: {format(new Date(payment.due_date), "MMM dd")}
                            </p>
                          </div>
                          <Badge variant="destructive">{formatCurrency(payment.invoice_amount - payment.amount_paid)}</Badge>
                        </div>
                      ))}
                    {totalOverdue === 0 && (
                      <p className="text-muted-foreground text-center py-4">No overdue payments</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-500" />
                    Upcoming Payments
                  </CardTitle>
                  <CardDescription>
                    Payments due in the next 7 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {payments?.filter(p => 
                      p.status !== "paid" && 
                      !isPast(new Date(p.due_date)) && 
                      new Date(p.due_date) <= addDays(today, 7)
                    )
                      .slice(0, 3)
                      .map(payment => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div>
                            <p className="font-medium">{payment.client_name}</p>
                            <p className="text-sm text-blue-600">
                              Due: {format(new Date(payment.due_date), "MMM dd")}
                            </p>
                          </div>
                          <Badge variant="secondary">{formatCurrency(payment.invoice_amount)}</Badge>
                        </div>
                      ))}
                    {upcomingPayments === 0 && (
                      <p className="text-muted-foreground text-center py-4">No upcoming payments</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by client name or project..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payments Grid */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : !filteredPayments || filteredPayments.length === 0 ? (
              <Card className="border-0 shadow-soft">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {searchQuery || statusFilter !== "all" ? "No matching payments" : "No payments assigned"}
                  </h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Payment follow-ups assigned to you will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPayments.map(getPaymentCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
