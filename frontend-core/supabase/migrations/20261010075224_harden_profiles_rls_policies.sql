/*
# Harden profiles RLS policies

## Problem
The original INSERT policy only checked `auth.uid() = id`, which allowed
an authenticated user to explicitly pass `role: 'admin'` when creating
their own profile, bypassing the DEFAULT 'student' column value.

The original anon role also held full table-level privileges (SELECT,
INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE) on profiles — excessive
since no RLS policy allows anon access. RLS blocked anon in practice,
but the privilege grants were unnecessarily broad.

## Changes

### 1. INSERT policy — blocks self-promotion to admin
The WITH CHECK now also enforces `role = 'student'`, so a client that
explicitly passes `role: 'admin'` in the insert payload will be rejected
by RLS, not just by the column DEFAULT.

### 2. Revoke excessive anon privileges
The anon role no longer holds any privilege on profiles. It had no
legitimate path (no anon RLS policies), so keeping the grants was
unnecessary surface area.

## Security guarantees after this migration
- A new user can only insert a profile with role = 'student'.
- A user can read only their own profile.
- A user can update their own profile but cannot change their role.
- No user can delete their profile.
- The anon role cannot read or write profiles at all.
- Admin role assignment requires a direct database operation (dashboard
  or a server-side privileged function) — no client path exists.
*/

-- Revoke excessive anon privileges (authenticated keeps its grants via RLS)
REVOKE ALL ON profiles FROM anon;

-- Recreate INSERT policy: enforce role = 'student' so no client can
-- self-assign admin by explicitly passing the column value.
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student');
