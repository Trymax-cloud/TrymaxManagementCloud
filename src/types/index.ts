// User and Authentication Types
export type UserRole = 'employee' | 'manager' | 'director';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Assignment Types
export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';
export type AssignmentPriority = 'normal' | 'high' | 'emergency';

export interface Assignment {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  assigneeId: string;
  projectId?: string;
  createdDate: string;
  dueDate?: string;
  completionDate?: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  remark?: string;
}

export interface AssignmentStatusHistory {
  id: string;
  assignmentId: string;
  oldStatus: AssignmentStatus;
  newStatus: AssignmentStatus;
  remark?: string;
  changedBy: string;
  changedAt: string;
}

// Project Types
export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled';
export type ProjectStage = 'order_received' | 'inspection' | 'dispatch' | 'delivery';

export interface Project {
  id: string;
  name: string;
  clientName: string;
  startDate: string;
  endDate?: string;
  description?: string;
  status: ProjectStatus;
  stage: ProjectStage;
  createdBy: string;
}

// Rating Types
export type RatingPeriodType = 'monthly' | 'yearly';

export interface EmployeeRating {
  id: string;
  userId: string;
  periodType: RatingPeriodType;
  periodValue: string; // e.g., "2025-04" or "2025"
  score: number;
  remarks?: string;
  createdBy: string;
  createdAt: string;
}

// Payment Types
export type PaymentStatus = 'pending' | 'partially_paid' | 'paid';

export interface ClientPayment {
  id: string;
  clientName: string;
  projectId?: string;
  invoiceAmount: number;
  invoiceDate: string;
  dueDate: string;
  status: PaymentStatus;
  responsibleUserId: string;
}

// Notification Types
export type NotificationType = 'assignment' | 'project' | 'payment' | 'rating' | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
  readFlag: boolean;
}

// Daily Summary Types
export interface DailySummary {
  id: string;
  userId: string;
  date: string;
  tasksCompleted: number;
  tasksPending: number;
  tasksInProgress: number;
  emergencyTasks: number;
  notes?: string;
}
