-- ============================================
-- UPDATED SCHEMA: STANDALONE ROLE TABLES
-- ============================================
-- Each role table stores its own credentials
-- No dependency on auth.users or public.users

-- Add password_hash column to system_admins if not exists
ALTER TABLE system_admins 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add password_hash column to station_admins if not exists
ALTER TABLE station_admins 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add password_hash column to law_enforcement_officers if not exists
ALTER TABLE law_enforcement_officers 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Make user_id nullable (no longer required)
ALTER TABLE system_admins ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE station_admins ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE law_enforcement_officers ALTER COLUMN user_id DROP NOT NULL;

-- Drop foreign key constraints if they exist
DO $$
BEGIN
    -- Drop FK from system_admins
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'system_admins_user_id_fkey') THEN
        ALTER TABLE system_admins DROP CONSTRAINT system_admins_user_id_fkey;
    END IF;
    
    -- Drop FK from station_admins
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'station_admins_user_id_fkey') THEN
        ALTER TABLE station_admins DROP CONSTRAINT station_admins_user_id_fkey;
    END IF;
    
    -- Drop FK from law_enforcement_officers
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'law_enforcement_officers_user_id_fkey') THEN
        ALTER TABLE law_enforcement_officers DROP CONSTRAINT law_enforcement_officers_user_id_fkey;
    END IF;
END $$;

-- Disable RLS for simplicity (or create open policies)
ALTER TABLE system_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE station_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE law_enforcement_officers DISABLE ROW LEVEL SECURITY;

-- Or if you prefer RLS enabled with open policies:
-- ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "open_policy" ON system_admins;
-- CREATE POLICY "open_policy" ON system_admins FOR ALL USING (true) WITH CHECK (true);

-- Update the existing admin with a password hash
-- Password: Admin@123456 (you'll need to hash this in the app)
-- For now, we'll store plaintext temporarily and hash it on first login

-- Verify structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('system_admins', 'station_admins', 'law_enforcement_officers')
AND column_name IN ('user_id', 'password_hash', 'cnic', 'badge_number', 'email')
ORDER BY table_name, column_name;
