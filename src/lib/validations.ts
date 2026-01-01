import { z } from "zod";

// Assignment Validation Schemas
export const assignmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional()
    .nullable(),
  assigneeIds: z
    .array(z.string().uuid("Invalid assignee ID"))
    .min(1, "At least one assignee is required"),
  projectId: z.string().uuid("Invalid project ID").optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["normal", "high", "emergency"], {
    errorMap: () => ({ message: "Invalid priority" }),
  }),
  status: z.enum(["not_started", "in_progress", "completed", "on_hold"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
  remark: z
    .string()
    .trim()
    .max(1000, "Remark must be less than 1000 characters")
    .optional()
    .nullable(),
});

export const assignmentUpdateSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed", "on_hold"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
  remark: z
    .string()
    .trim()
    .max(1000, "Remark must be less than 1000 characters")
    .optional()
    .nullable(),
});

// Project Validation Schemas
export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(200, "Name must be less than 200 characters"),
  clientName: z
    .string()
    .trim()
    .min(1, "Client name is required")
    .max(200, "Client name must be less than 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional()
    .nullable(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "on_hold", "cancelled"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
});

// Payment Validation Schemas
export const paymentSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(1, "Client name is required")
    .max(200, "Client name must be less than 200 characters"),
  projectId: z.string().uuid("Invalid project ID").optional().nullable(),
  invoiceAmount: z
    .number()
    .positive("Invoice amount must be positive")
    .max(999999999999, "Amount too large"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  responsibleUserId: z.string().uuid("Invalid responsible user ID"),
  status: z.enum(["pending", "partially_paid", "paid"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
  amountPaid: z
    .number()
    .min(0, "Amount paid cannot be negative")
    .optional()
    .default(0),
  remarks: z
    .string()
    .trim()
    .max(1000, "Remarks must be less than 1000 characters")
    .optional()
    .nullable(),
});

export const paymentUpdateSchema = z.object({
  status: z.enum(["pending", "partially_paid", "paid"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
  amountPaid: z.number().min(0, "Amount paid cannot be negative").optional(),
  remarks: z
    .string()
    .trim()
    .max(1000, "Remarks must be less than 1000 characters")
    .optional()
    .nullable(),
});

// Rating Validation Schemas
export const ratingSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  periodType: z.enum(["monthly", "yearly"], {
    errorMap: () => ({ message: "Invalid period type" }),
  }),
  periodValue: z
    .string()
    .trim()
    .min(1, "Period value is required")
    .max(10, "Period value too long"),
  score: z
    .number()
    .min(0, "Score must be at least 0")
    .max(5, "Score must be at most 5"),
  remarks: z
    .string()
    .trim()
    .max(1000, "Remarks must be less than 1000 characters")
    .optional()
    .nullable(),
});

// Profile Validation Schemas
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  avatarUrl: z.string().url("Invalid URL").optional().nullable(),
});

// Auth Validation Schemas
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be less than 72 characters"),
});

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be less than 72 characters"),
  role: z.enum(["employee", "director"], {
    errorMap: () => ({ message: "Invalid role" }),
  }),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(72, "Password must be less than 72 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Daily Summary Validation
export const dailySummarySchema = z.object({
  date: z.string().min(1, "Date is required"),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be less than 2000 characters")
    .optional()
    .nullable(),
});

// Type exports
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
export type RatingInput = z.infer<typeof ratingSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type DailySummaryInput = z.infer<typeof dailySummarySchema>;
