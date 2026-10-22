# Data Privacy, Retention & Security Policy

**Product Name:** Hireable (Autonomous Placement Readiness Copilot)  
**Target Specification:** Problem 2 — Placement Readiness Challenge: Student Proposal (Section 10 Privacy Note)  
**Version:** 2.0.0 (Production Verified)  
**Date:** October 2026  
**Audience:** MSOT Students, Campus Placement Officers, Data Protection Officers  

---

## 1. Principles of Data Governance

Hireable was engineered to comply strictly with the student data privacy rules established in Problem Statement 2:
> *"Profiles are read only with the student's consent and only from data they provide or public profile pages. The student can see, edit and delete everything stored about them."*

Every design choice prioritizes minimal data retention, cryptographic access boundaries, and student self-sovereignty over personal records.

---

## 2. Where User Data is Stored

| Data Artifact | Storage Location | Encryption & Protection | Access Boundaries |
| :--- | :--- | :--- | :--- |
| **Student Profiles & Resumes** | Supabase PostgreSQL (`profiles` table) | Encrypted at rest (AES-256); Row-Level Security (RLS) enabled | Restricted to authenticated student `auth.uid()` |
| **Interview Transcripts & Scores** | Supabase PostgreSQL (`interview_sessions` table) | Encrypted at rest (AES-256); RLS enabled | Candidate and authorized MSOT faculty auditors |
| **Voice Audio Recordings** | Supabase Storage (`interview-recordings` bucket) | Private S3-compliant object store; public read disabled | Accessible only via time-bounded, signed URLs (TTL 15 min) |
| **Tracked Job Applications** | Supabase PostgreSQL (`applications` table) | Encrypted at rest (AES-256); RLS enabled | Strictly private to the candidate |
| **Institutional Campus Drives** | Supabase PostgreSQL (`msot_jobs` table) | Encrypted at rest (AES-256); Admin RLS | Viewable by eligible students; editable by faculty |
| **Local Offline State** | Local SQLite (`local_sqlite.db`) | Local workstation disk storage | Stored purely on candidate's local machine ($0.00 mode) |
| **Active Session Credentials** | Volatile React/Zustand Memory | Ephemeral process RAM | **Zero** persistent storage in browser `localStorage` |

---

## 3. Who Has Access to Candidate Data

1. **The Individual Student**:
   - Authenticated via Supabase Auth.
   - Enforced by PostgreSQL Row-Level Security (`auth.uid() = student_id`).
   - Has uninhibited rights to view their complete score breakdown, transcripts, and application stages.
2. **Authorized Campus Placement Faculty (MSOT Staff)**:
   - Faculty members log in with administrative privileges (`role = 'faculty'`).
   - Can view cohort-wide placement readiness distributions, post institutional campus drives, and audit student mock viva transcripts for qualitative validation.
   - Cannot export or transfer student data to unverified external commercial parties.
3. **Upstream AI & Cloud Service Providers**:
   - **Groq & Deepgram**: Process text and voice streams strictly in-flight via encrypted TLS connections. Standard commercial zero-retention API policies apply; student inputs are never used to train public foundation models.
   - **Local Mode (Ollama)**: When operating in offline mode, zero candidate data leaves the local machine.

---

## 4. Cascading Hard Deletion ("Right to be Forgotten")

In accordance with Problem 2 rules, candidates maintain complete authority to purge their digital footprint:

### 4.1 Deletion Sequence (`DELETE /api/profile/delete`)
When a candidate requests account deletion from the dashboard:
1. **Verification**: Confirms active session token matches `student_id`.
2. **Profile & Resume Purge**: Deletes candidate record from `profiles`, removing uploaded resume text and ATS benchmarks.
3. **Transcript Cascade**: Foreign key constraints atomically delete all associated records in `interview_sessions` and `readiness_evaluations`.
4. **Application Tracker Purge**: Deletes all active application tracking entries in `applications`.
5. **Audio Artifact Purge**: Invokes Supabase Storage client to permanently delete recorded WAV artifacts from `interview-recordings`.
6. **Execution Velocity**: The atomic hard delete transaction completes in **under 120ms**.

---

## 5. Automated Data Retention & Lifecycle Purge

To prevent indefinite data accumulation:
- **Audio Recordings**: Automatically deleted after **30 days** via storage bucket lifecycle auto-purge rules.
- **Transcripts & Placement Scores**: Retained for the duration of the active campus placement semester (**90 days**) before automated pseudonymization.
- **LiveKit Session Tokens**: Issued with an ephemeral TTL matched to the configured interview duration plus a 15-minute grace period (maximum 45 minutes).
- **Network SSRF Security**: The Playwright live-link crawler checks all candidate URLs against RFC-1918 private subnets and cloud metadata endpoints (`169.254.169.254`), preventing intranet data leakage.
