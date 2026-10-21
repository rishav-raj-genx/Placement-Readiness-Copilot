/**
 * scripts/provision-staff-admin.mjs
 *
 * Secure server-side provisioning script for MSOT staff and faculty admin accounts.
 * Executes strictly outside client bundles using the Supabase Service Role Key.
 *
 * Usage:
 *   node scripts/provision-staff-admin.mjs [email] [password] [displayName]
 * Or configure via environment variables:
 *   STAFF_ADMIN_EMAIL, STAFF_ADMIN_PASSWORD, STAFF_ADMIN_NAME
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(__dir, '../.env.local');
const envRootPath = resolve(__dir, '../../.env');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = val.replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvFile(envLocalPath);
loadEnvFile(envRootPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Staff admin provisioning requires server-side administrative service credentials.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = anonKey
  ? createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const args = process.argv.slice(2);
const ADMIN_EMAIL = args[0] || process.env.STAFF_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@hireable.com';
const ADMIN_PASSWORD = args[1] || process.env.STAFF_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'MSOTAdmin2026!';
const DISPLAY_NAME = args[2] || process.env.STAFF_ADMIN_NAME || 'MSOT Placement Faculty Admin';

async function main() {
  console.log('MSOT Secure Staff/Faculty Provisioning');
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  console.log(`Target staff account: ${ADMIN_EMAIL}`);

  // 1. Check if user already exists
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  let user = usersData?.users?.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  if (!user) {
    console.log(`Creating verified staff admin account: ${ADMIN_EMAIL}...`);
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: DISPLAY_NAME,
        role: 'admin',
      },
    });

    if (createError) {
      console.error('Error creating staff account:', createError.message);
      process.exit(1);
    }
    user = createData.user;
    console.log(`Staff admin created successfully with ID: ${user.id}`);
  } else {
    console.log(`Staff account exists (ID: ${user.id}). Updating credentials and admin role metadata...`);
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        display_name: DISPLAY_NAME,
        role: 'admin',
      },
    });
    if (updateError) {
      console.error('Error updating staff account:', updateError.message);
      process.exit(1);
    }
    user = updateData.user;
  }

  // 2. Authoritative database profile synchronization
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    console.log('Inserting admin profile in public.profiles...');
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: user.id,
      email: ADMIN_EMAIL,
      display_name: DISPLAY_NAME,
      role: 'admin',
    });
    if (profileError) {
      console.error('Error creating admin profile:', profileError.message);
      process.exit(1);
    }
    console.log('Admin profile created.');
  } else if (existingProfile.role !== 'admin') {
    console.log(`Updating existing profile role from "${existingProfile.role}" to "admin"...`);
    const { error: updateProfileError } = await adminClient
      .from('profiles')
      .update({ role: 'admin', display_name: DISPLAY_NAME })
      .eq('id', user.id);
    if (updateProfileError) {
      console.error('Error upgrading profile role:', updateProfileError.message);
      process.exit(1);
    }
    console.log('Profile updated to admin.');
  } else {
    console.log('Profile already has role: "admin".');
  }

  // 3. Optional client login test if anon key is available
  if (anonClient) {
    console.log('\nValidating secure server-side authentication with anon client...');
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (authError) {
      console.error('❌ Staff admin authentication validation failed:', authError.message);
      process.exit(1);
    }

    console.log('✔ Staff admin authentication verified successfully!');
    console.log(`- Authenticated User ID: ${authData.user.id}`);
    console.log(`- Email: ${authData.user.email}`);
  }

  console.log('\nStaff account is fully provisioned and securely authenticated server-side.');
}

main().catch((err) => {
  console.error('Unexpected error during provisioning:', err);
  process.exit(1);
});
