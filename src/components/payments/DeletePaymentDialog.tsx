import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeletePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  paymentInfo: {
    clientName: string;
    amount: number;
  } | null;
  isLoading?: boolean;
}

export function DeletePaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  paymentInfo,
  isLoading = false,
}: DeletePaymentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the payment
            {paymentInfo && (
              <>
                {" "}from <strong>{paymentInfo.clientName}</strong> for{" "}
                <strong>${paymentInfo.amount.toLocaleString()}</strong>
              </>
            )}
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? "Deleting..." : "Delete Payment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
