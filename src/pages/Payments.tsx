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
import { usePayments, useMyPayments, useOverduePayments } from "@/hooks/usePayments";
import { useProfiles } from "@/hooks/useProfiles";
import { useProjects } from "@/hooks/useProjects";
import { useUserRole } from "@/hooks/useUserRole";
import { CreatePaymentModal } from "@/components/payments/CreatePaymentModal";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  CreditCard, Plus, AlertCircle, IndianRupee, Clock, 
  CheckCircle2, Search, Filter, Mail, Loader2 
} from "lucide-react";

export default function Payments() {
  const { isDirector } = useUserRole();
  const { data: allPayments, isLoading: allLoading } = usePayments();
  const { data: myPayments, isLoading: myLoading } = useMyPayments();
  const { data: overduePayments } = useOverduePayments();
  const { data: profiles } = useProfiles();
  const { data: projects } = useProjects();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingReminders, setSendingReminders] = useState(false);

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
    setSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-reminders");
      
      if (error) {
        console.error("Error sending reminders:", error);
        toast.error("Failed to send payment reminders");
        return;
      }
      
      if (data?.sent > 0) {
        toast.success(`Sent ${data.sent} payment reminder email(s)`);
      } else {
        toast.info("No payment reminders to send at this time");
      }
      
      if (data?.errors?.length > 0) {
        console.warn("Some emails failed:", data.errors);
      }
    } catch (err) {
      console.error("Error invoking function:", err);
      toast.error("Failed to send payment reminders");
    } finally {
      setSendingReminders(false);
    }
  };
  return (
    <AppLayout title="Client Payments">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Track and manage client payment follow-ups
          </p>
          {isDirector && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={handleSendReminders}
                disabled={sendingReminders}
              >
                {sendingReminders ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Send Reminders
              </Button>
              <Button className="gap-2" onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4" />
                New Payment
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
