-- ============================================
-- CRIMEX WEB DASHBOARD - STANDALONE ROLE TABLES
-- ============================================
-- This script updates the role tables to be completely standalone
-- WITHOUT any dependency on auth.users or public.users table
--
-- Each role table now stores its own password_hash
-- ============================================

-- STEP 1: Add password_hash column to all role tables
-- ============================================

ALTER TABLE system_admins 
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE station_admins 
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE law_enforcement_officers 
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- STEP 2: Remove foreign key constraints to auth.users (if they exist)
-- ============================================

-- Check and drop foreign key on system_admins.user_id
ALTER TABLE system_admins 
  DROP CONSTRAINT IF EXISTS system_admins_user_id_fkey;

-- Check and drop foreign key on station_admins.user_id  
ALTER TABLE station_admins 
  DROP CONSTRAINT IF EXISTS station_admins_user_id_fkey;

-- Check and drop foreign key on law_enforcement_officers.user_id
ALTER TABLE law_enforcement_officers 
  DROP CONSTRAINT IF EXISTS law_enforcement_officers_user_id_fkey;

-- STEP 3: Make user_id column nullable (not required anymore)
-- ============================================

ALTER TABLE system_admins 
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE station_admins 
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE law_enforcement_officers 
  ALTER COLUMN user_id DROP NOT NULL;

-- STEP 4: Update existing test user to have password_hash
-- ============================================

UPDATE system_admins 
SET password_hash = 'Admin@123456'
WHERE cnic = '1234567890123';

-- STEP 5: Create RLS policies for direct table access
-- ============================================

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_enforcement_officers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow anon to read system_admins for login" ON system_admins;
DROP POLICY IF EXISTS "Allow anon to read station_admins for login" ON station_admins;
DROP POLICY IF EXISTS "Allow anon to read leos for login" ON law_enforcement_officers;
DROP POLICY IF EXISTS "Allow insert to system_admins" ON system_admins;
DROP POLICY IF EXISTS "Allow insert to station_admins" ON station_admins;
DROP POLICY IF EXISTS "Allow insert to leos" ON law_enforcement_officers;
DROP POLICY IF EXISTS "Allow update system_admins" ON system_admins;
DROP POLICY IF EXISTS "Allow update station_admins" ON station_admins;
DROP POLICY IF EXISTS "Allow update leos" ON law_enforcement_officers;

-- Create new policies for ANON access (since we're not using Supabase Auth)

-- System Admins - Read access for login
CREATE POLICY "anon_read_system_admins"
ON system_admins FOR SELECT
TO anon, authenticated
USING (true);

-- System Admins - Insert access for creating new admins
CREATE POLICY "anon_insert_system_admins"
ON system_admins FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- System Admins - Update access
CREATE POLICY "anon_update_system_admins"
ON system_admins FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Station Admins - Read access for login
CREATE POLICY "anon_read_station_admins"
ON station_admins FOR SELECT
TO anon, authenticated
USING (true);

-- Station Admins - Insert access
CREATE POLICY "anon_insert_station_admins"
ON station_admins FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Station Admins - Update access
CREATE POLICY "anon_update_station_admins"
ON station_admins FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- LEO - Read access for login
CREATE POLICY "anon_read_leos"
ON law_enforcement_officers FOR SELECT
TO anon, authenticated
USING (true);

-- LEO - Insert access
CREATE POLICY "anon_insert_leos"
ON law_enforcement_officers FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- LEO - Update access
CREATE POLICY "anon_update_leos"
ON law_enforcement_officers FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Police Stations - Read access
DROP POLICY IF EXISTS "Anyone can view police stations" ON police_stations;
CREATE POLICY "anon_read_police_stations"
ON police_stations FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check test user has password_hash
SELECT id, cnic, full_name, email, password_hash, is_active 
FROM system_admins 
WHERE cnic = '1234567890123';

-- Verify columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('system_admins', 'station_admins', 'law_enforcement_officers')
  AND column_name = 'password_hash';

-- ============================================
-- DONE! 
-- ============================================
-- After running this script:
-- 1. Test login with CNIC: 1234567890123, Password: Admin@123456
-- 2. Try creating new users from the dashboard
-- ============================================
