/**
 * scripts/provision-test-student.mjs
 *
 * Provisions a verified test student account in Supabase using the Admin API
 * so that live E2E interview tests can run without email confirmation
 * or triggering Supabase email rate limits.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (key && val) process.env[key] = val;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = 'student.test@copilot.dev';
const TEST_PASSWORD = 'TestStudent2026!';
const DISPLAY_NAME = 'Test Student';

async function main() {
  console.log('Connecting to Supabase project:', supabaseUrl);

  // 1. Check if user already exists
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  let user = usersData.users.find((u) => u.email === TEST_EMAIL);

  if (!user) {
    console.log(`Creating user ${TEST_EMAIL}...`);
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: DISPLAY_NAME,
        role: 'student',
      },
    });

    if (createError) {
      console.error('Error creating user:', createError.message);
      process.exit(1);
    }
    user = createData.user;
    console.log(`User created successfully with ID: ${user.id}`);
  } else {
    console.log(`User ${TEST_EMAIL} already exists (ID: ${user.id}). Updating password and confirming email...`);
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: DISPLAY_NAME,
        role: 'student',
      },
    });
    if (updateError) {
      console.error('Error updating user:', updateError.message);
      process.exit(1);
    }
    user = updateData.user;
  }

  // 2. Ensure profile exists in public.profiles
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    console.log('Creating profile record...');
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: user.id,
      email: TEST_EMAIL,
      display_name: DISPLAY_NAME,
      role: 'student',
    });
    if (profileError) {
      console.warn('Warning creating profile:', profileError.message);
    } else {
      console.log('Profile created in public.profiles');
    }
  } else {
    console.log('Profile already exists in public.profiles');
  }

  // 3. Test authentication using anon key (as the frontend would do)
  console.log('\nTesting client login with public anon key...');
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error('❌ Anon login failed:', authError.message);
    process.exit(1);
  }

  console.log(' Client login successful!');
  console.log('Authenticated session token received:');
  console.log(`- User ID: ${authData.user.id}`);
  console.log(`- Email: ${authData.user.email}`);
  console.log(`- Role: ${authData.user.user_metadata?.role || 'student'}`);
  console.log('\nAccount is fully verified and ready for E2E tests.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
