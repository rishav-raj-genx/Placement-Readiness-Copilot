'use client';

import { create } from 'zustand';
import type { ChatMessage, ChatAttachment, ProfileLinkType } from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';

interface ChatState {
  messages: ChatMessage[];
  isHydrated: boolean;
  isSending: boolean;
  attachments: ChatAttachment[];

  hydrate: () => void;
  sendMessage: (content: string) => void;
  addAttachment: (file: File, kind?: ChatAttachment['kind']) => void;
  addProfileLink: (type: ProfileLinkType, url: string) => void;
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

  addAttachment: (file: File, kind = 'document') => {
    const attachment: ChatAttachment = {
      id: 'att-' + Date.now(),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      status: 'uploaded',
      statusMessage: 'File uploaded successfully and ready for analysis.',
      kind,
    };
    set({ attachments: [...get().attachments, attachment] });
  },

  addProfileLink: (type: ProfileLinkType, url: string) => {
    const attachment: ChatAttachment = {
      id: `link-${type}-${Date.now()}`,
      fileName: `${type[0].toUpperCase()}${type.slice(1)} profile`,
      fileSize: 0,
      mimeType: 'text/uri-list',
      status: 'uploaded',
      statusMessage: 'Profile link saved and ready for analysis.',
      kind: 'profile_link',
      linkType: type,
      url,
    };
    set({
      attachments: [
        ...get().attachments.filter((item) => item.linkType !== type),
        attachment,
      ],
    });
  },

  removeAttachment: (id: string) => {
    set({ attachments: get().attachments.filter((a) => a.id !== id) });
  },

  clearAttachments: () => set({ attachments: [] }),
}));
