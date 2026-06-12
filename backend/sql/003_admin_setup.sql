-- ============================================================
-- ADMIN SETUP: Run in Supabase SQL Editor
-- Makes vidurbh@gmail.com an admin and adds to orgs
-- ============================================================

-- 1. Make vidurbh@gmail.com an admin
UPDATE profiles
SET role = 'admin', updated_at = NOW()
WHERE email = 'vidurbh@gmail.com';

-- 2. Add vidurbh@gmail.com to all existing orgs (if not already a member)
INSERT INTO user_orgs (user_id, org_id, role)
SELECT p.id, o.id, 'admin'
FROM profiles p
CROSS JOIN orgs o
WHERE p.email = 'vidurbh@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM user_orgs uo
    WHERE uo.user_id = p.id AND uo.org_id = o.id
  )
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 3. Verify the changes
SELECT p.id, p.email, p.role, uo.org_id, o.name as org_name, uo.role as org_role
FROM profiles p
LEFT JOIN user_orgs uo ON uo.user_id = p.id
LEFT JOIN orgs o ON o.id = uo.org_id
WHERE p.email = 'vidurbh@gmail.com';