'use client';

import { create } from 'zustand';
import type { ChatMessage, ChatAttachment } from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';

interface ChatState {
  messages: ChatMessage[];
  isHydrated: boolean;
  isSending: boolean;
  attachments: ChatAttachment[];

  hydrate: () => void;
  sendMessage: (content: string) => void;
  addAttachment: (file: File) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isHydrated: false,
  isSending: false,
  attachments: [],

  hydrate: () => {
    const messages = loadFromStorage<ChatMessage[]>('chat-messages', []);
    set({ messages, isHydrated: true });
  },

  sendMessage: (content: string) => {
    if (!content.trim() && get().attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content,
      attachments: get().attachments.length > 0 ? [...get().attachments] : undefined,
      timestamp: new Date().toISOString(),
    };

    const messages = [...get().messages, userMessage];
    saveToStorage('chat-messages', messages);
    set({ messages, isSending: false, attachments: [] });
  },

  addAttachment: (file: File) => {
    const attachment: ChatAttachment = {
      id: 'att-' + Date.now(),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      status: 'uploaded',
      statusMessage: 'File uploaded successfully and ready for analysis.',
    };
    set({ attachments: [...get().attachments, attachment] });
  },

  removeAttachment: (id: string) => {
    set({ attachments: get().attachments.filter((a) => a.id !== id) });
  },

  clearAttachments: () => set({ attachments: [] }),
}));
