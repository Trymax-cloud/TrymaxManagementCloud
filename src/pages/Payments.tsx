import { useState } from "react";
import { format, isPast } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { usePayments, useMyPayments, useOverduePayments, usePaymentRealtime } from "@/hooks/usePayments";
import { useProfiles } from "@/hooks/useProfiles";
import { useProjects } from "@/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import { usePaymentReminders, useDeletePayment } from "@/hooks/usePaymentReminders";
import { useSendPaymentReminders } from "@/hooks/useSendPaymentReminders";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { CreatePaymentModal } from "@/components/payments/CreatePaymentModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  CalendarDays, Mail, Loader2, Plus, Search, IndianRupee, AlertTriangle, CheckCircle, Clock, AlertCircle, CheckCircle2, Filter, CreditCard
} from "lucide-react";

export default function Payments() {
  const { isDirector } = useUserRole();
  const { data: allPayments, isLoading: allLoading } = usePayments();
  const { data: myPayments, isLoading: myLoading } = useMyPayments();
  const { data: overduePayments } = useOverduePayments();
  const { data: profiles } = useProfiles();
  const { data: projects } = useProjects();
  const { sendReminders, isLoading: sendingReminders } = usePaymentReminders();
  const { deletePayment, isLoading: deletingPayment } = useDeletePayment();
  const sendPaymentReminders = useSendPaymentReminders();
  
  // Enable real-time updates
  usePaymentRealtime();
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const payments = isDirector ? allPayments : myPayments;
  const isLoading = isDirector ? allLoading : myLoading;

  const getProfileName = (userId: string) => {
    return profiles?.find(p => p.id === userId)?.name || "Unknown";
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return undefined;
    return projects?.find(p => p.id === projectId)?.name;
  };

  const filteredPayments = payments?.filter(payment => {
    const matchesSearch = 
      payment.client_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPending = payments?.filter(p => p.status === "pending").length || 0;
  const totalOverdue = overduePayments?.length || 0;
  const totalPaid = payments?.filter(p => p.status === "paid").length || 0;
  const totalAmount = payments?.reduce((acc, p) => acc + p.invoice_amount, 0) || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSendReminders = async () => {
    if (selectedPayments.length === 0) {
      toast.error("Please select payments to send reminders for");
      return;
    }

    try {
      const result = await sendPaymentReminders.mutateAsync(false); // Manual reminder
      console.log('Payment reminders result:', result);
      toast.success(`Payment reminders processed: ${result.sent} sent, ${result.skipped} skipped`);
      setSelectedPayments([]);
    } catch (error) {
      console.error("Failed to send reminders:", error);
      toast.error("Failed to send payment reminders");
    }
  };

  const handleSelectPayment = (paymentId: string, checked: boolean) => {
    if (checked) {
      setSelectedPayments(prev => [...prev, paymentId]);
    } else {
      setSelectedPayments(prev => prev.filter(id => id !== paymentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredPayments) {
      setSelectedPayments(filteredPayments.map(p => p.id));
    } else {
      setSelectedPayments([]);
    }
  };

  const handleDeletePayment = async (payment: { id: string; client_name: string; invoice_amount: number }) => {
    try {
      await deletePayment(payment.id);
      // Clear selection if deleted payment was selected
      setSelectedPayments(prev => prev.filter(id => id !== payment.id));
    } catch (error) {
      console.error("Delete failed:", error);
      // Add more detailed error logging
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          paymentId: payment.id,
          paymentName: payment.client_name
        });
      }
    }
  };

  return (
    <AppLayout title="Client Payments">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">
              Manage client payments and send reminders
            </p>
          </div>
          {isDirector && (
            <div className="flex gap-2">
              <Button 
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Payment
              </Button>
              <Button 
                onClick={handleSendReminders}
                disabled={selectedPayments.length === 0 || sendPaymentReminders.isPending}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Mail className="h-4 w-4" />
                {sendPaymentReminders.isPending ? "Sending..." : "Send Reminders"}
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IndianRupee className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
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

        {/* Selection Controls */}
        {isDirector && filteredPayments && filteredPayments.length > 0 && (
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedPayments.length === filteredPayments.length && filteredPayments.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All ({selectedPayments.length}/{filteredPayments.length})
              </label>
            </div>
            {selectedPayments.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{selectedPayments.length} payment{selectedPayments.length > 1 ? 's' : ''} selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPayments([])}
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by client name..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
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

        {/* Overdue Alert */}
        {totalOverdue > 0 && (
          <Card className="border-0 shadow-soft bg-destructive/5 border-l-4 border-l-destructive">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <p className="font-medium">
                  {totalOverdue} payment{totalOverdue > 1 ? "s are" : " is"} overdue and require{totalOverdue === 1 ? "s" : ""} immediate follow-up
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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
                {searchQuery || statusFilter !== "all" ? "No matching payments" : "No payments tracked"}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {isDirector 
                  ? "Create payment entries to track client payment follow-ups"
                  : "Payment follow-ups assigned to you will appear here"}
              </p>
              {isDirector && !searchQuery && statusFilter === "all" && (
                <Button className="mt-4 gap-2" onClick={() => setCreateModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Payment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPayments.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                responsibleName={getProfileName(payment.responsible_user_id)}
                projectName={getProjectName(payment.project_id)}
                canEdit={isDirector || payment.responsible_user_id === profiles?.find(p => p.email)?.id}
                isSelected={selectedPayments.includes(payment.id)}
                onSelect={handleSelectPayment}
                onDelete={isDirector ? handleDeletePayment : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {isDirector && (
        <CreatePaymentModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      )}
    </AppLayout>
  );
}
