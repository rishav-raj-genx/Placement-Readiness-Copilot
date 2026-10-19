import Image from 'next/image';
import { cn } from '@/lib/utils';

interface HireableLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
  withGlow?: boolean;
}

export function HireableLogo({
  size = 32,
  className,
  priority = false,
  withGlow = false,
}: HireableLogoProps) {
  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center select-none', className)}
      style={{ width: size, height: size }}
    >
      {withGlow && (
        <div
          className="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-blue-600/40 via-cyan-400/30 to-purple-600/40 blur-md"
          aria-hidden="true"
        />
      )}
      <Image
        src="/hireable-logo.png"
        alt="Hireable"
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
      />
    </div>
  );
}
