'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  AlertCircle,
  Loader2,
  Github,
  Linkedin,
  Code2,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase-client';
import type { ProfileLinks, ProfileLinkType } from '@/types';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const profileLinkFields: Array<{
  type: ProfileLinkType;
  label: string;
  placeholder: string;
}> = [
  { type: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/your-name' },
  { type: 'github', label: 'GitHub', placeholder: 'https://github.com/your-handle' },
  { type: 'leetcode', label: 'LeetCode', placeholder: 'https://leetcode.com/u/your-handle' },
];

function isValidProfileUrl(type: ProfileLinkType, value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.pathname === '/') return false;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const allowedHost = type === 'linkedin' ? 'linkedin.com' : `${type}.com`;
    return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
  } catch {
    return false;
  }
}

function githubUsernameFromUrl(value: string): string {
  if (!value) return '';
  try {
    return new URL(value).pathname.split('/').filter(Boolean)[0] ?? '';
  } catch {
    return '';
  }
}

export default function ResourcesPage() {
  const { user } = useAuthStore();

  const [profileLinks, setProfileLinks] = useState<ProfileLinks>({
    linkedin: '',
    github: '',
    leetcode: '',
  });
  const [resumePath, setResumePath] = useState('');
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (loadedUserIdRef.current === user.id) return;
    let active = true;

    supabase
      .from('profiles')
      .select('github_username, linkedin_url, leetcode_url, resume_pdf_path')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        loadedUserIdRef.current = user.id;
        const githubUsername = typeof data.github_username === 'string' ? data.github_username : '';
        setProfileLinks({
          linkedin: typeof data.linkedin_url === 'string' ? data.linkedin_url : '',
          github: githubUsername ? `https://github.com/${githubUsername}` : '',
          leetcode: typeof data.leetcode_url === 'string' ? data.leetcode_url : '',
        });
        setResumePath(typeof data.resume_pdf_path === 'string' ? data.resume_pdf_path : '');
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Upload a valid PDF resume.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Resume PDF must be smaller than 10 MB.');
      return;
    }
    if (!user) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }

    const path = `${user.id}/resume.pdf`;
    setIsUploadingResume(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('candidate-documents')
        .upload(path, file, { contentType: 'application/pdf', upsert: true });
      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ resume_pdf_path: path })
        .eq('id', user.id);
      if (profileError) {
        await supabase.storage.from('candidate-documents').remove([path]);
        throw profileError;
      }

      setResumePath(path);
      toast.success('Resume uploaded successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resume upload failed.';
      toast.error(message);
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleSaveLinks = async (): Promise<void> => {
    const filledLinks = profileLinkFields.filter(({ type }) => profileLinks[type].trim());
    const invalidField = filledLinks.find(
      ({ type }) => !isValidProfileUrl(type, profileLinks[type].trim())
    );
    if (invalidField) {
      toast.error(`Enter a valid HTTPS ${invalidField.label} profile URL.`);
      return;
    }
    if (!user) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }

    setIsSavingLinks(true);
    try {
      const normalizedLinks: ProfileLinks = {
        linkedin: profileLinks.linkedin.trim(),
        github: profileLinks.github.trim(),
        leetcode: profileLinks.leetcode.trim(),
      };
      const { error } = await supabase
        .from('profiles')
        .update({
          linkedin_url: normalizedLinks.linkedin || null,
          github_username: normalizedLinks.github ? githubUsernameFromUrl(normalizedLinks.github) : null,
          leetcode_url: normalizedLinks.leetcode || null,
        })
        .eq('id', user.id);
      if (error) throw error;

      setProfileLinks(normalizedLinks);
      toast.success('Profile links saved successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile links.';
      toast.error(message);
    } finally {
      setIsSavingLinks(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Resume & Resources"
        description="Upload your resume and attach your professional profile links to prepare context for AI interviews."
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Resume Upload Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-brand" />
              Resume Document
            </CardTitle>
            <CardDescription>
              Your PDF resume is used to analyze your background and personalize interview questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between space-y-4">
            {resumePath ? (
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 border border-brand/20">
                      <FileText className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">resume.pdf</p>
                      <p className="text-xs text-muted-foreground">Stored securely in Supabase</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-brand/30 bg-brand/10 text-brand">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Uploaded
                  </Badge>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingResume}
                  >
                    {isUploadingResume ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    )}
                    Replace Resume
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-brand/50 bg-muted/30 hover:bg-muted/60 transition-all p-8 text-center flex flex-col items-center justify-center gap-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 border border-brand/20">
                  {isUploadingResume ? (
                    <Loader2 className="h-6 w-6 text-brand animate-spin" />
                  ) : (
                    <UploadCloud className="h-6 w-6 text-brand" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Click to upload your resume PDF</p>
                  <p className="text-xs text-muted-foreground">PDF only, maximum 10 MB</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Only PDF files up to 10 MB are accepted.</span>
            </div>
          </CardContent>
        </Card>

        {/* Profile Links Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5 text-brand" />
              Professional Profiles
            </CardTitle>
            <CardDescription>
              Attach your public profiles so the placement copilot can evaluate your coding and work history.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between space-y-4">
            <div className="space-y-3.5">
              {profileLinkFields.map(({ type, label, placeholder }) => {
                const Icon = type === 'linkedin' ? Linkedin : type === 'github' ? Github : Code2;
                return (
                  <div key={type} className="space-y-1.5">
                    <Label htmlFor={`${type}-profile-link`} className="text-xs font-medium">
                      {label} URL
                    </Label>
                    <div className="relative">
                      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id={`${type}-profile-link`}
                        type="url"
                        placeholder={placeholder}
                        value={profileLinks[type]}
                        onChange={(e) =>
                          setProfileLinks((current) => ({
                            ...current,
                            [type]: e.target.value,
                          }))
                        }
                        className="h-10 pl-9 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="brand"
                size="sm"
                onClick={handleSaveLinks}
                disabled={isSavingLinks}
              >
                {isSavingLinks && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Save Profile Links
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
