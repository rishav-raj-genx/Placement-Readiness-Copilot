'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessagesSquare,
  Send,
  Paperclip,
  X,
  Link2,
  FileText,
  Brain,
  AlertCircle,
  Loader2,
  Github,
  Linkedin,
  Code2,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase-client';
import type { ProfileLinks, ProfileLinkType } from '@/types';
import { format } from 'date-fns';
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
  return new URL(value).pathname.split('/').filter(Boolean)[0] ?? '';
}

export default function ResourcesPage() {
  const {
    messages,
    isHydrated,
    isSending,
    attachments,
    sendMessage,
    addAttachment,
    addProfileLink,
    removeAttachment,
    hydrate,
  } = useChatStore();
  const { user } = useAuthStore();

  const [input, setInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [profileLinks, setProfileLinks] = useState<ProfileLinks>({
    linkedin: '',
    github: '',
    leetcode: '',
  });
  const [resumePath, setResumePath] = useState('');
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .from('profiles')
      .select('github_username, linkedin_url, leetcode_url, resume_pdf_path')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error || !data) return;
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
  }, [user]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Upload a PDF resume.');
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

      addAttachment(file, 'resume');
      setResumePath(path);
      toast.success('Resume uploaded securely. Add a message and send it for analysis.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resume upload failed.';
      toast.error(message);
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleSaveLinks = async (): Promise<void> => {
    const invalidField = profileLinkFields.find(
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
          linkedin_url: normalizedLinks.linkedin,
          github_username: githubUsernameFromUrl(normalizedLinks.github),
          leetcode_url: normalizedLinks.leetcode,
        })
        .eq('id', user.id);
      if (error) throw error;

      for (const { type } of profileLinkFields) {
        addProfileLink(type, normalizedLinks[type]);
      }
      setProfileLinks(normalizedLinks);
      setShowLinkInput(false);
      toast.success('Profile links saved and attached to the chat.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile links.';
      toast.error(message);
    } finally {
      setIsSavingLinks(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    sendMessage(input);
    setInput('');
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadedDocuments = useMemo(() => {
    const allAttachments = [
      ...messages.flatMap((message) => message.attachments ?? []),
      ...attachments,
    ];
    return allAttachments.filter(
      (attachment, index) =>
        (attachment.kind === 'resume' || attachment.mimeType === 'application/pdf') &&
        allAttachments.findIndex((candidate) => candidate.fileName === attachment.fileName) === index
    );
  }, [attachments, messages]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Resume & Resources"
        description="Chat with your AI assistant, upload documents, and prepare with context."
      />

      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">
            <MessagesSquare className="mr-1.5 h-4 w-4" />
            Chat Assistant
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-1.5 h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="flex h-[600px] flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Brain className="h-3 w-3" />
                        MSOT Assistant
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
                              msg.role === 'user' ? 'bg-brand-foreground/10' : 'bg-card border border-border'
                            }`}
                          >
                            <FileText className="h-3 w-3 shrink-0" />
                            {att.url ? (
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate underline">
                                {att.fileName}
                              </a>
                            ) : (
                              <span className="truncate">{att.fileName}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={`mt-1 text-xs ${msg.role === 'user' ? 'text-brand-foreground/70' : 'text-muted-foreground'}`}>
                      {format(new Date(msg.timestamp), 'HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="border-t border-border px-4 py-2 space-y-1.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {att.url ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-medium hover:underline">
                          {att.fileName}
                        </a>
                      ) : (
                        <span className="text-xs font-medium truncate">{att.fileName}</span>
                      )}
                      <Badge variant="outline" className="text-xs shrink-0">
                        {att.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {att.statusMessage}
                      </span>
                      <button onClick={() => removeAttachment(att.id)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Link Input */}
            {showLinkInput && (
              <div className="space-y-3 border-t border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">Profile links</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {profileLinkFields.map(({ type, label, placeholder }) => {
                    const Icon = type === 'linkedin' ? Linkedin : type === 'github' ? Github : Code2;
                    return (
                      <div key={type} className="space-y-1.5">
                        <Label htmlFor={`${type}-profile-link`} className="text-xs">{label}</Label>
                        <div className="relative">
                          <Icon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id={`${type}-profile-link`}
                            type="url"
                            placeholder={placeholder}
                            value={profileLinks[type]}
                            onChange={(event) => setProfileLinks((current) => ({
                              ...current,
                              [type]: event.target.value,
                            }))}
                            className="h-9 pl-8 text-xs"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowLinkInput(false)} disabled={isSavingLinks}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="brand" onClick={handleSaveLinks} disabled={isSavingLinks}>
                    {isSavingLinks && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Save & attach links
                  </Button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-border p-3 space-y-2">
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload resume PDF"
                  disabled={isUploadingResume}
                >
                  {isUploadingResume ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLinkInput(!showLinkInput)}
                  title="Add LinkedIn, GitHub, and LeetCode links"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  rows={1}
                  className="min-h-[40px] max-h-32 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  variant="brand"
                  size="icon"
                  onClick={handleSend}
                  disabled={isSending || (!input.trim() && attachments.length === 0)}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Upload a PDF resume (max 10 MB) and attach LinkedIn, GitHub, and LeetCode profiles.
                </span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="py-8">
              {resumePath || uploadedDocuments.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-semibold">Uploaded documents</h3>
                  </div>
                  {uploadedDocuments.length > 0 ? uploadedDocuments.map((document) => (
                    <div key={document.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-4 w-4 shrink-0 text-brand" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{document.fileName}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(document.fileSize)}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{document.status}</Badge>
                    </div>
                  )) : (
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-brand" />
                        <div>
                          <p className="text-sm font-medium">Resume PDF</p>
                          <p className="text-xs text-muted-foreground">Stored securely in Supabase</p>
                        </div>
                      </div>
                      <Badge variant="outline">uploaded</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/50">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-medium">No resume uploaded</h3>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Upload a PDF resume through the chat assistant to make it available to the readiness services.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                    <span className="text-xs text-foreground/80">Only PDF files up to 10 MB are accepted.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
