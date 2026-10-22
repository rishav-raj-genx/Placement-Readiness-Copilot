'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';
import { toast } from '@/lib/toast';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      closeButton
      visibleToasts={3}
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-stone-800 group-[.toaster]:bg-[#28201E] group-[.toaster]:text-stone-100 group-[.toaster]:shadow-2xl group-[.toaster]:font-sans group-[.toaster]:text-xs',
          description: 'group-[.toast]:text-stone-400 group-[.toast]:text-[11px]',
          error:
            '!border-[#D93829]/70 !bg-[#28201E] !text-[#FFD2CC] [&_[data-icon]]:!text-[#D93829]',
          success:
            '!border-emerald-700/60 !bg-[#28201E] !text-emerald-200 [&_[data-icon]]:!text-emerald-400',
          warning:
            '!border-amber-700/60 !bg-[#28201E] !text-amber-200 [&_[data-icon]]:!text-amber-400',
          info:
            '!border-stone-700 !bg-[#28201E] !text-stone-200 [&_[data-icon]]:!text-stone-400',
          actionButton:
            'group-[.toast]:bg-[#D93829] group-[.toast]:text-white font-semibold hover:group-[.toast]:bg-[#C22F21]',
          cancelButton:
            'group-[.toast]:bg-stone-800 group-[.toast]:text-stone-300 hover:group-[.toast]:bg-stone-700',
          closeButton:
            '!border-stone-700 !bg-stone-800 !text-stone-400 hover:!text-stone-100 hover:!bg-stone-700',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
