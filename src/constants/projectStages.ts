// Project Stages - Single Source of Truth
// All UI must consume from this file ONLY

export type ProjectStage = 
  | "order_received"
  | "shipment_plan" 
  | "order_to_supplier"
  | "inspection"
  | "dispatch"
  | "delivery";

export const PROJECT_STAGES: { value: ProjectStage; label: string }[] = [
  { value: "order_received", label: "Order Received" },
  { value: "shipment_plan", label: "Shipment Plan" },
  { value: "order_to_supplier", label: "Order to Supplier" },
  { value: "inspection", label: "Inspection" },
  { value: "dispatch", label: "Dispatch" },
  { value: "delivery", label: "Delivery" },
];

// Backward compatibility mapping
export const STAGE_NORMALIZATION: Record<string, ProjectStage> = {
  "inspect": "inspection",
  "Inspect": "inspection", 
  "INSPECT": "inspection",
};
