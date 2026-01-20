-- Step 1: Extend app_role enum with new roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'warehouse';