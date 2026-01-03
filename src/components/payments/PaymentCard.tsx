import { useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { Calendar, User, IndianRupee, AlertCircle, Check, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ClientPayment, useUpdatePayment } from "@/hooks/usePayments";

interface PaymentCardProps {
  payment: ClientPayment;
  responsibleName?: string;
  projectName?: string;
  canEdit?: boolean;
  isSelected?: boolean;
  onSelect?: (paymentId: string, checked: boolean) => void;
  onDelete?: (payment: { id: string; client_name: string; invoice_amount: number }) => void;
}

export function PaymentCard({ 
  payment, 
  responsibleName, 
  projectName, 
  canEdit = false, 
  isSelected = false, 
  onSelect, 
  onDelete 
}: PaymentCardProps) {
  const updatePayment = useUpdatePayment();
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [partialAmount, setPartialAmount] = useState(payment.amount_paid.toString());

  const dueDate = new Date(payment.due_date);
  const isOverdue = isPast(dueDate) && payment.status !== "paid";
  const isDueToday = isToday(dueDate);

  const remainingAmount = payment.invoice_amount - payment.amount_paid;
  const paidPercentage = payment.invoice_amount > 0 
    ? Math.round((payment.amount_paid / payment.invoice_amount) * 100) 
    : 0;

  const getStatusColor = () => {
    switch (payment.status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "partially_paid":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "pending":
        return isOverdue 
          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "partially_paid") {
      setShowPartialInput(true);
    } else if (newStatus === "paid") {
      // When marked as paid, set amount_paid to full invoice amount
      updatePayment.mutate({
        id: payment.id,
        status: newStatus as ClientPayment["status"],
        amount_paid: payment.invoice_amount,
      });
      setShowPartialInput(false);
    } else {
      // When marked as pending, reset amount_paid to 0
      updatePayment.mutate({
        id: payment.id,
        status: newStatus as ClientPayment["status"],
        amount_paid: 0,
      });
      setShowPartialInput(false);
    }
  };

  const handlePartialPaymentSubmit = () => {
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount < 0 || amount > payment.invoice_amount) {
      return;
    }
    
    updatePayment.mutate({
      id: payment.id,
      status: "partially_paid",
      amount_paid: amount,
    });
    setShowPartialInput(false);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  return (
    <Card className={cn(
      "border-0 shadow-soft transition-all",
      isOverdue && "ring-2 ring-destructive/20"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1">
            {onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(payment.id, checked as boolean)}
                className="mt-1"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold">{payment.client_name}</h3>
              {projectName && (
                <p className="text-sm text-muted-foreground">{projectName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor()}>
              {payment.status.replace("_", " ")}
            </Badge>
            {onDelete && canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(payment)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <IndianRupee className="h-5 w-5 text-muted-foreground" />
              {formatAmount(payment.invoice_amount)}
            </div>
          </div>
          
          {/* Show payment progress for partially paid */}
          {payment.status === "partially_paid" && (
            <div className="space-y-1.5 p-2 bg-muted/50 rounded-md">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-green-600">{formatAmount(payment.amount_paid)}</span>
              </div>
              <Progress value={paidPercentage} className="h-2" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium text-orange-600">{formatAmount(remainingAmount)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Invoice:</span>
            <span>{format(new Date(payment.invoice_date), "MMM d, yyyy")}</span>
          </div>
          <div className={cn(
            "flex items-center gap-2",
            isOverdue && "text-destructive",
            isDueToday && "text-warning"
          )}>
            {isOverdue && <AlertCircle className="h-4 w-4" />}
            {!isOverdue && <Calendar className="h-4 w-4 text-muted-foreground" />}
            <span className={cn(!isOverdue && "text-muted-foreground")}>Due:</span>
            <span className="font-medium">
              {format(dueDate, "MMM d, yyyy")}
              {isDueToday && " (Today)"}
              {isOverdue && " (Overdue)"}
            </span>
          </div>
          {responsibleName && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Responsible:</span>
              <span>{responsibleName}</span>
            </div>
          )}
        </div>

        {payment.remarks && (
          <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
            {payment.remarks}
          </p>
        )}

        {canEdit && (
          <div className="pt-2 border-t space-y-3">
            {showPartialInput ? (
              <div className="space-y-2">
                <Label className="text-sm">Amount Paid (₹)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={payment.invoice_amount}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={handlePartialPaymentSubmit}
                    disabled={updatePayment.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowPartialInput(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Max: {formatAmount(payment.invoice_amount)}
                </p>
              </div>
            ) : (
              <Select
                value={payment.status}
                onValueChange={handleStatusChange}
                disabled={updatePayment.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Update status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}