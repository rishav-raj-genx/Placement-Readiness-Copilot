import { describe, expect, it } from 'vitest';
import { validateResumeFile, validatePdf, MAX_PDF_BYTES } from '@/lib/onboarding';
import { normalizeApplications, normalizeApplicationStatus } from '@/lib/data-adapters';
import { KANBAN_COLUMNS } from '@/types';

describe('Flexible Profile Intake & Application Tracker', () => {
  it('accepts both .pdf and .docx resume files within size limit', () => {
    const pdfFile = new File(['%PDF-1.4...'], 'resume.pdf', { type: 'application/pdf' });
    const docxFile = new File(['PK...'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const txtFile = new File(['plain text'], 'resume.txt', { type: 'text/plain' });
    const oversizedPdf = new File([new Uint8Array(MAX_PDF_BYTES + 1)], 'big.pdf', {
      type: 'application/pdf',
    });

    expect(validateResumeFile(pdfFile)).toBeNull();
    expect(validateResumeFile(docxFile)).toBeNull();
    expect(validateResumeFile(txtFile)).toMatch(/PDF \(.pdf\) and Word \(.docx\)/);
    expect(validateResumeFile(oversizedPdf)).toMatch(/10 MB/);

    // Standard validatePdf accepts only PDF
    expect(validatePdf(pdfFile)).toBeNull();
    expect(validatePdf(docxFile)).toMatch(/Only PDF/);
  });

  it('strictly maps interviewing status string to interview', () => {
    expect(normalizeApplicationStatus('interviewing')).toBe('interview');
    expect(normalizeApplicationStatus('interview')).toBe('interview');
    expect(normalizeApplicationStatus('saved')).toBe('saved');
    expect(normalizeApplicationStatus('applied')).toBe('applied');
  });

  it('includes saved and interview in Kanban columns', () => {
    const columnIds = KANBAN_COLUMNS.map((col) => col.id);
    expect(columnIds).toContain('saved');
    expect(columnIds).toContain('interview');
    expect(columnIds).not.toContain('interviewing');

    const columnLabels = KANBAN_COLUMNS.map((col) => col.label);
    expect(columnLabels).toContain('Saved');
    expect(columnLabels).toContain('Interview');
    expect(columnLabels).not.toContain('Interviewing');
  });

  it('normalizes application follow_up_date properly', () => {
    const raw = [
      {
        id: 'app-1',
        student_id: 'user-1',
        company: 'Stripe',
        role: 'Frontend Engineer',
        status: 'interviewing',
        applied_at: '2026-10-20T10:00:00Z',
        follow_up_date: '2026-10-25T00:00:00Z',
        url: 'https://stripe.com/jobs/1',
      },
    ];

    const [normalized] = normalizeApplications(raw);
    expect(normalized.status).toBe('interview');
    expect(normalized.followUpDate).toBe('2026-10-25T00:00:00Z');
    expect(normalized.jobPostingUrl).toBe('https://stripe.com/jobs/1');
  });
});
