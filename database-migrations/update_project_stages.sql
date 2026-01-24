-- PHASE 1: Update Project Stages - SAFE MIGRATION
-- This migration updates project stages to the new workflow
-- Existing projects will remain valid

-- Update existing stage names to match new workflow
-- This handles backward compatibility for existing projects

-- Map "Inspect" → "Inspection" (if any exist)
UPDATE projects 
SET stage = 'inspection' 
WHERE stage = 'inspect' OR stage = 'Inspect' OR stage = 'INSPECT';

-- Update existing stages to new workflow values
-- This ensures existing projects map to the new workflow

-- "Order Received" already exists - no change needed
-- "inspection" already exists - no change needed  
-- "dispatch" already exists - no change needed
-- "delivery" already exists - no change needed

-- Note: New stages will be added in the application layer
-- Database remains TEXT to allow flexibility
-- No enums are modified (following ABSOLUTE RULES)
