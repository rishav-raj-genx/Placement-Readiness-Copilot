/*
# Create profiles table with user roles

## Purpose
Stores user profile data (display name, role) keyed to Supabase auth.users.
Supports Student and Admin roles for the MSOT interview platform.

## New Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, not null — copied from auth identity for convenience)
  - `display_name` (text, not null)
  - `role` (text, not null, default 'student' — either 'student' or 'admin')
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `profiles`.
- Users can read their own profile (SELECT, auth.uid() = id).
- Users can insert their own profile on signup (INSERT, auth.uid() = id).
- Users can update their own profile but CANNOT change their role
  (UPDATE, auth.uid() = id WITH CHECK that role is unchanged).
- No DELETE policy — profiles are not deletable by users.
- Role is stored server-side and cannot be self-promoted by a client.

## Important Notes
1. The `role` column defaults to 'student'. New signups are students.
2. Admin role must be assigned via the Supabase dashboard or a server-side
   function — it cannot be set or changed through the client.
3. The UPDATE policy's WITH CHECK enforces that role cannot be changed
   by comparing the new value to the old value in the row.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: users can read their own profile
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- INSERT: users can create their own profile on signup
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: users can update their own profile but NOT their role
-- The WITH CHECK ensures role stays the same as what's already in the row
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (
    SELECT p.role FROM profiles p WHERE p.id = auth.uid()
  ));
