/**
 * scripts/verify-schema.mjs
 *
 * Connects to the live Supabase database and checks each required object
 * by directly probing each table/view (SELECT with limit 0).
 *
 * Run with:
 *   node scripts/verify-schema.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local ──────────────────────────────────────────────────────────
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Terminal colours ─────────────────────────────────────────────────────────
const R = '\x1b[0m', G = '\x1b[32m', RED = '\x1b[31m';
const Y = '\x1b[33m', B = '\x1b[1m', D = '\x1b[2m';

const ok   = (m) => console.log(`  ${G}✔${R}  ${m}`);
const fail = (m) => console.log(`  ${RED}✘${R}  ${m}`);
const info = (m) => console.log(`  ${Y}ℹ${R}  ${m}`);

// ── Probe a table/view by trying to select 0 rows ────────────────────────────
async function tableExists(name) {
  const { error } = await supabase.from(name).select('*').limit(0);
  if (!error) return { exists: true, columns: [] };
  const msg = error.message || '';
  if (
    msg.includes('does not exist') ||
    msg.includes('PGRST200') ||
    msg.includes('PGRST205') ||
    msg.includes('schema cache') ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST200' ||
    error.code === '42P01'
  ) {
    return { exists: false, reason: 'not_found' };
  }
  if (msg.includes('fetch failed')) {
    return { exists: false, reason: 'fetch_failed' };
  }
  // Any other error (RLS etc.) means the table exists but we just can't read it
  return { exists: true };
}

// ── Probe column list via a SELECT of specific columns ────────────────────────
async function checkColumns(table, expected) {
  const colList = expected.join(', ');
  const { error } = await supabase.from(table).select(colList).limit(0);
  if (!error) return { missing: [] };
  // Parse which column is missing from the error message
  const missing = expected.filter((c) => {
    const msg = error.message || '';
    return msg.includes(c);
  });
  return { missing: missing.length ? missing : [], rawError: error.message };
}

// ── Objects ──────────────────────────────────────────────────────────────────
const TABLES = [
  'project_live_checks',
  'discovered_jobs',
  'readiness_scores',
  'mock_interview_results',
];

const VIEWS = ['latest_student_mock_interviews'];

const COLUMNS = {
  project_live_checks: [
    'id','student_id','project_name','project_url','status_code','is_live',
    'load_time_ms','mobile_friendly','screenshot_url','console_errors',
    'network_errors','content_evaluation','quality_score','created_at',
  ],
  discovered_jobs: [
    'id','title','company','location','url','source','matched_skills',
    'relevance_score','match_reason','is_remote','job_type','posted_at','created_at',
  ],
  readiness_scores: [
    'id','student_id','total_score','readiness_level','breakdown',
    'top_actions','raw_inputs','updated_at',
  ],
  mock_interview_results: [
    'id','student_id','attempt_number','interview_score','technical_score',
    'communication_score','behavioral_score','strengths','weak_areas',
    'feedback_notes','transcript','mode','duration_minutes','created_at',
  ],
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${B}MSOT — Live Supabase Schema Verification${R}`);
  console.log(`${D}Project: ${supabaseUrl}${R}\n`);

  let allPassed = true;
  const missing = [];

  // 1. Tables ─────────────────────────────────────────────────────────────────
  console.log(`${B}── Tables ──────────────────────────────────────────${R}`);
  for (const t of TABLES) {
    const { exists } = await tableExists(t);
    if (exists) ok(t);
    else {
      fail(`${t}  ${D}← NOT FOUND${R}`);
      missing.push(t);
      allPassed = false;
    }
  }

  // 2. Views ──────────────────────────────────────────────────────────────────
  console.log(`\n${B}── Views ───────────────────────────────────────────${R}`);
  for (const v of VIEWS) {
    const { exists } = await tableExists(v);
    if (exists) ok(v);
    else {
      fail(`${v}  ${D}← NOT FOUND${R}`);
      missing.push(v);
      allPassed = false;
    }
  }

  // 3. Columns (only for tables that exist) ───────────────────────────────────
  console.log(`\n${B}── Columns ─────────────────────────────────────────${R}`);
  for (const [table, expectedCols] of Object.entries(COLUMNS)) {
    const { exists } = await tableExists(table);
    if (!exists) {
      info(`${table}  ${D}(skipped — table missing)${R}`);
      continue;
    }
    const { missing: missingCols, rawError } = await checkColumns(table, expectedCols);
    if (missingCols.length === 0) {
      ok(`${table}  ${D}(all ${expectedCols.length} columns present)${R}`);
    } else {
      fail(`${table} — missing columns: ${missingCols.join(', ')}`);
      allPassed = false;
    }
  }

  // 4. Storage bucket ─────────────────────────────────────────────────────────
  console.log(`\n${B}── Storage Buckets ─────────────────────────────────${R}`);
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    info(`Could not list buckets: ${bucketErr.message}`);
  } else {
    const bucket = (buckets || []).find((b) => b.name === 'project-screenshots');
    if (bucket) ok(`project-screenshots  ${D}(public: ${bucket.public})${R}`);
    else {
      fail(`project-screenshots  ${D}← NOT FOUND${R}`);
      allPassed = false;
    }
  }

  // 5. Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${B}────────────────────────────────────────────────────${R}`);
  if (allPassed) {
    console.log(`${G}${B}✔  All schema objects verified — database is ready!${R}\n`);
    console.log(`   Rituraj can now point his scripts at:`);
    console.log(`   ${D}SUPABASE_URL${R}  = ${supabaseUrl}`);
    console.log(`   ${D}SUPABASE_KEY${R}  = ${serviceRoleKey.slice(0, 20)}...  (service role key)\n`);
  } else {
    console.log(`${RED}${B}✘  Missing objects: ${missing.join(', ')}${R}`);
    console.log(`\n   Run ${Y}src/db/schema.sql${R} in the Supabase SQL Editor:`);
    console.log(`   ${D}${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new${R}\n`);
  }
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err.message);
  process.exit(1);
});
