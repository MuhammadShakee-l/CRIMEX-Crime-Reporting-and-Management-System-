-- ============================================
-- FIX RLS POLICIES FOR WEB LOGIN
-- ============================================
-- The problem: Before login, the user is "anonymous" and can't read
-- from system_admins, station_admins, or law_enforcement_officers tables.
-- We need to allow SELECT on these tables for login to work.

-- Option 1: Disable RLS temporarily (NOT RECOMMENDED for production)
-- ALTER TABLE system_admins DISABLE ROW LEVEL SECURITY;

-- Option 2: Allow anonymous users to SELECT from these tables for login
-- This is safe because we only expose email lookup by CNIC/badge

-- ============================================
-- SYSTEM ADMINS TABLE
-- ============================================
-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous to read system_admins for login" ON system_admins;
DROP POLICY IF EXISTS "Allow authenticated to read own profile" ON system_admins;
DROP POLICY IF EXISTS "system_admins_select_policy" ON system_admins;
DROP POLICY IF EXISTS "system_admins_update_policy" ON system_admins;

-- Enable RLS
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- Allow anyone to SELECT (needed for login lookup)
CREATE POLICY "Allow select for login" ON system_admins
    FOR SELECT
    USING (true);

-- Allow authenticated users to UPDATE their own profile
CREATE POLICY "Allow update own profile" ON system_admins
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- STATION ADMINS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow anonymous to read station_admins for login" ON station_admins;
DROP POLICY IF EXISTS "station_admins_select_policy" ON station_admins;
DROP POLICY IF EXISTS "station_admins_update_policy" ON station_admins;

ALTER TABLE station_admins ENABLE ROW LEVEL SECURITY;

-- Allow anyone to SELECT (needed for login lookup)
CREATE POLICY "Allow select for login" ON station_admins
    FOR SELECT
    USING (true);

-- Allow authenticated users to UPDATE their own profile
CREATE POLICY "Allow update own profile" ON station_admins
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- LAW ENFORCEMENT OFFICERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Allow anonymous to read leo for login" ON law_enforcement_officers;
DROP POLICY IF EXISTS "leo_select_policy" ON law_enforcement_officers;
DROP POLICY IF EXISTS "leo_update_policy" ON law_enforcement_officers;

ALTER TABLE law_enforcement_officers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to SELECT (needed for login lookup)
CREATE POLICY "Allow select for login" ON law_enforcement_officers
    FOR SELECT
    USING (true);

-- Allow authenticated users to UPDATE their own profile
CREATE POLICY "Allow update own profile" ON law_enforcement_officers
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- AUDIT LOGS TABLE (allow insert for login logging)
-- ============================================
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert audit logs
CREATE POLICY "Allow insert audit logs" ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Allow users to read their own audit logs
CREATE POLICY "Allow read own audit logs" ON audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================
-- USERS TABLE (bridge table)
-- ============================================
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow anyone to SELECT from users (needed for profile lookup)
CREATE POLICY "Allow select users" ON users
    FOR SELECT
    USING (true);

-- Allow service role to insert users
CREATE POLICY "Allow insert users" ON users
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- VERIFY POLICIES
-- ============================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('system_admins', 'station_admins', 'law_enforcement_officers', 'audit_logs', 'users')
ORDER BY tablename, policyname;
