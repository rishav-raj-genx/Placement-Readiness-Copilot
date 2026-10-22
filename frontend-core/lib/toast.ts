'use client';

import React from 'react';
import { toast as sonnerToast, type ExternalToast } from 'sonner';

/**
 * Branded Toast Utility for Placement Readiness Copilot
 * - Prevents duplicate stacking by automatically deriving toast ID from message string
 * - Seamless drop-in replacement with Warm Lava and obsidian themed options
 */
function resolveToastId(message: React.ReactNode, explicitId?: string | number): string | number | undefined {
  if (explicitId !== undefined) return explicitId;
  if (typeof message === 'string' && message.trim().length > 0) {
    return message.trim();
  }
  return undefined;
}

export const toast = {
  ...sonnerToast,
  error: (message: React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.error(message, {
      id: resolveToastId(message, data?.id),
      ...data,
    });
  },
  success: (message: React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.success(message, {
      id: resolveToastId(message, data?.id),
      ...data,
    });
  },
  info: (message: React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.info(message, {
      id: resolveToastId(message, data?.id),
      ...data,
    });
  },
  warning: (message: React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.warning(message, {
      id: resolveToastId(message, data?.id),
      ...data,
    });
  },
};

export default toast;
