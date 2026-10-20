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
          className="absolute inset-0 -z-10 rounded-full bg-red-600/10"
          aria-hidden="true"
        />
      )}
      <Image
        src="/logo.png"
        alt="Hireable"
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
