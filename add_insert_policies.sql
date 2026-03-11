-- ============================================
-- ADD INSERT POLICIES FOR USER CREATION
-- ============================================
-- Allow authenticated users (admins) to insert new users

-- System Admins
DROP POLICY IF EXISTS "Allow insert system_admins" ON system_admins;
CREATE POLICY "Allow insert system_admins" ON system_admins
    FOR INSERT
    WITH CHECK (true);

-- Station Admins  
DROP POLICY IF EXISTS "Allow insert station_admins" ON station_admins;
CREATE POLICY "Allow insert station_admins" ON station_admins
    FOR INSERT
    WITH CHECK (true);

-- Law Enforcement Officers
DROP POLICY IF EXISTS "Allow insert leo" ON law_enforcement_officers;
CREATE POLICY "Allow insert leo" ON law_enforcement_officers
    FOR INSERT
    WITH CHECK (true);

-- Verify policies
SELECT tablename, policyname, cmd FROM pg_policies 
WHERE tablename IN ('system_admins', 'station_admins', 'law_enforcement_officers')
ORDER BY tablename, policyname;
