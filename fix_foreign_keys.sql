-- ============================================
-- FIX FOREIGN KEY CONSTRAINTS FOR USER CREATION
-- ============================================
-- The issue: users table references auth.users, but we want to create
-- profiles without requiring auth users first.

-- Option 1: Remove the foreign key from users table to auth.users
-- This allows creating users in public.users without auth.users entry

-- First, find and drop the constraint
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'users' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No foreign key constraint found on users table';
    END IF;
END $$;

-- Also check station_admins, system_admins, law_enforcement_officers
-- They should reference public.users, not auth.users directly

-- Make sure users table allows inserts
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies for users table
DROP POLICY IF EXISTS "Allow select users" ON users;
DROP POLICY IF EXISTS "Allow insert users" ON users;
DROP POLICY IF EXISTS "Allow update users" ON users;

CREATE POLICY "Allow all on users" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Also ensure the profile tables allow inserts
DROP POLICY IF EXISTS "Allow insert system_admins" ON system_admins;
DROP POLICY IF EXISTS "Allow insert station_admins" ON station_admins;
DROP POLICY IF EXISTS "Allow insert leo" ON law_enforcement_officers;

CREATE POLICY "Allow all system_admins" ON system_admins
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all station_admins" ON station_admins
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all leo" ON law_enforcement_officers
    FOR ALL USING (true) WITH CHECK (true);

-- Verify the constraints
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public' 
AND tc.table_name IN ('users', 'system_admins', 'station_admins', 'law_enforcement_officers')
AND tc.constraint_type = 'FOREIGN KEY';
