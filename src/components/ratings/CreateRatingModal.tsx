import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateRating } from "@/hooks/useRatings";
import { useProfiles } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";

const ratingSchema = z.object({
  user_id: z.string().min(1, "Please select an employee"),
  period_type: z.enum(["monthly", "yearly"]),
  period_value: z.string().min(1, "Please select a period"),
  score: z.number().min(1).max(5),
  remarks: z.string().max(500).optional(),
});

type RatingFormData = z.infer<typeof ratingSchema>;

interface CreateRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRatingModal({ open, onOpenChange }: CreateRatingModalProps) {
  const createRating = useCreateRating();
  const { data: profiles } = useProfiles();
  const [hoveredStar, setHoveredStar] = useState(0);

  const form = useForm<RatingFormData>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      user_id: "",
      period_type: "monthly",
      period_value: format(new Date(), "yyyy-MM"),
      score: 0,
      remarks: "",
    },
  });

  const periodType = form.watch("period_type");
  const currentScore = form.watch("score");

  // Generate period options
  const getPeriodOptions = () => {
    const options = [];
    const now = new Date();
    
    if (periodType === "monthly") {
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        options.push({
          value: format(date, "yyyy-MM"),
          label: format(date, "MMMM yyyy"),
        });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const year = now.getFullYear() - i;
        options.push({
          value: year.toString(),
          label: year.toString(),
        });
      }
    }
    
    return options;
  };

  const onSubmit = async (data: RatingFormData) => {
    if (data.score === 0) {
      form.setError("score", { message: "Please select a rating" });
      return;
    }

    try {
      await createRating.mutateAsync({
        user_id: data.user_id,
        period_type: data.period_type,
        period_value: data.period_value,
        score: data.score,
        remarks: data.remarks,
      });
      form.reset();
      setHoveredStar(0);
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCancel = () => {
    form.reset();
    setHoveredStar(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Submit Employee Rating</DialogTitle>
          <DialogDescription>
            Rate an employee's performance for a specific period.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="period_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period Type</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("period_value", value === "monthly" 
                          ? format(new Date(), "yyyy-MM")
                          : new Date().getFullYear().toString()
                        );
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="period_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getPeriodOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="score"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating</FormLabel>
                  <FormControl>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="p-1 transition-transform hover:scale-110"
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          onClick={() => field.onChange(star)}
                        >
                          <Star
                            className={cn(
                              "h-8 w-8 transition-colors",
                              (hoveredStar ? star <= hoveredStar : star <= currentScore)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            )}
                          />
                        </button>
                      ))}
                      <span className="ml-2 self-center text-sm text-muted-foreground">
                        {currentScore > 0 ? `${currentScore} / 5` : "Select rating"}
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter performance feedback..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRating.isPending}>
                {createRating.isPending ? "Submitting..." : "Submit Rating"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
