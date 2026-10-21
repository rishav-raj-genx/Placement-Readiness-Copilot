const DRAFT_KEY = 'hireable:pending-signup';
const DATABASE_NAME = 'hireable-auth';
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = 'signup-documents';
const DOCUMENT_KEY = 'pending';

export interface PendingSignupDraft {
  displayName: string;
  email: string;
  targetRole: string;
  githubUsername: string;
  leetcodeUrl?: string;
  linkedinText?: string;
  linkedinUrl?: string;
  projects?: Array<{
    title?: string;
    name?: string;
    repoUrl?: string;
    liveUrl?: string;
    description: string;
  }>;
}

export interface PendingSignupDocuments {
  resume: File | null;
  linkedin: File | null;
}

function isPendingSignupDraft(value: unknown): value is PendingSignupDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.displayName === 'string'
    && typeof draft.email === 'string'
    && typeof draft.targetRole === 'string'
    && typeof draft.githubUsername === 'string';
}

export function savePendingSignupDraft(draft: PendingSignupDraft): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadPendingSignupDraft(): PendingSignupDraft | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(DRAFT_KEY);
  if (!stored) return null;

  try {
    const value: unknown = JSON.parse(stored);
    return isPendingSignupDraft(value) ? value : null;
  } catch {
    window.localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

function openDocumentDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DOCUMENT_STORE)) {
        request.result.createObjectStore(DOCUMENT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open signup document storage.'));
  });
}

function runDocumentTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDocumentDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(DOCUMENT_STORE, mode);
    const request = operation(transaction.objectStore(DOCUMENT_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to access saved signup documents.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Unable to save signup documents.'));
    };
  }));
}

export async function savePendingSignupDocuments(documents: PendingSignupDocuments): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  await runDocumentTransaction('readwrite', (store) => store.put(documents, DOCUMENT_KEY));
}

export async function loadPendingSignupDocuments(): Promise<PendingSignupDocuments> {
  if (typeof window === 'undefined' || !window.indexedDB) return { resume: null, linkedin: null };
  const value: unknown = await runDocumentTransaction('readonly', (store) => store.get(DOCUMENT_KEY));
  if (!value || typeof value !== 'object') return { resume: null, linkedin: null };
  const documents = value as Record<string, unknown>;
  return {
    resume: documents.resume instanceof File ? documents.resume : null,
    linkedin: documents.linkedin instanceof File ? documents.linkedin : null,
  };
}

export async function clearPendingSignup(): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DRAFT_KEY);
  if (!window.indexedDB) return;
  await runDocumentTransaction('readwrite', (store) => store.delete(DOCUMENT_KEY));
}
