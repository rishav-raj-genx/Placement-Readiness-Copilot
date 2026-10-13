'use client';

import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { DemoLabel } from '@/components/shared/demo-label';
import { useChatStore } from '@/stores/chat-store';
import { format } from 'date-fns';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['.pdf', '.doc', '.docx', '.txt'];

export default function ResourcesPage() {
  const {
    messages,
    isHydrated,
    isSending,
    attachments,
    sendMessage,
    addAttachment,
    removeAttachment,
    hydrate,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} exceeds the 5MB limit`);
        continue;
      }
      addAttachment(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) return;
    const fakeFile = new File([''], linkInput.trim(), { type: 'text/uri-list' });
    addAttachment(fakeFile);
    setLinkInput('');
    setShowLinkInput(false);
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
                            <span className="truncate">{att.fileName}</span>
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
                      <span className="text-xs font-medium truncate">{att.fileName}</span>
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
              <div className="border-t border-border px-4 py-2 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Paste job description URL..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  className="h-8"
                />
                <Button size="sm" variant="outline" onClick={handleAddLink}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowLinkInput(false)}>
                  Cancel
                </Button>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-border p-3 space-y-2">
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload PDF or document"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLinkInput(!showLinkInput)}
                  title="Add job description link"
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
                  File upload ready for interview skill extraction.
                </span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/50">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-medium">No documents uploaded</h3>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Upload your resume or job descriptions through the chat assistant to provide context for your interview preparation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DemoLabel />
                  <span className="text-xs text-muted-foreground">
                    Skill extraction coming soon
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-xs text-foreground/80">
                    Document analysis is not yet available. Uploaded files are stored locally only.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
