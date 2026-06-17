import * as React from 'react';
import { cn } from '@/lib/utils';

interface LogoSymbolProps extends React.SVGAttributes<SVGElement> {
  variant?: 'default' | 'inverse' | 'terracotta';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const LogoSymbol = React.forwardRef<SVGSVGElement, LogoSymbolProps>(
  ({ variant = 'default', size = 'md', className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-14 h-14',
      xl: 'w-20 h-20',
    };

    const colors = {
      default: { bg: '#F4EFE6', text: '#3D5A4C' },
      inverse: { bg: '#3D5A4C', text: '#F4EFE6' },
      terracotta: { bg: '#B96D4B', text: '#FFFFFF' },
    };

    const { bg, text } = colors[variant];

    return (
      <svg
        ref={ref}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizeClasses[size], 'rounded-xl', className)}
        {...props}
      >
        <rect width="64" height="64" rx="12" fill={bg} />
        <path
          d="M46 14H14v36h32v-8H22V22h24V14z"
          fill={text}
        />
      </svg>
    );
  }
);
LogoSymbol.displayName = 'LogoSymbol';

interface LogoFullProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const LogoFull = React.forwardRef<HTMLDivElement, LogoFullProps>(
  ({ variant = 'default', size = 'md', showTagline = true, className, ...props }, ref) => {
    const sizeConfig = {
      sm: {
        symbol: 'sm' as const,
        title: 'text-lg',
        tagline: 'text-xs',
        gap: 'gap-2',
      },
      md: {
        symbol: 'md' as const,
        title: 'text-xl',
        tagline: 'text-sm',
        gap: 'gap-3',
      },
      lg: {
        symbol: 'lg' as const,
        title: 'text-2xl',
        tagline: 'text-base',
        gap: 'gap-3',
      },
    };

    const colors = {
      default: {
        title: 'text-brand-green-dark',
        tagline: 'text-brand-green-light',
      },
      inverse: {
        title: 'text-brand-cream',
        tagline: 'text-brand-cream/60',
      },
    };

    const config = sizeConfig[size];
    const colorConfig = colors[variant];

    return (
      <div
        ref={ref}
        className={cn('flex items-center', config.gap, className)}
        {...props}
      >
        <LogoSymbol
          variant={variant === 'inverse' ? 'default' : 'inverse'}
          size={config.symbol}
        />
        <div>
          <span className={cn('font-semibold tracking-tight', config.title, colorConfig.title)}>
            CredHub
          </span>
          {showTagline && (
            <p className={cn('font-script', config.tagline, colorConfig.tagline)}>
              Sistema de crédito corporativo
            </p>
          )}
        </div>
      </div>
    );
  }
);
LogoFull.displayName = 'LogoFull';

interface LogoCircleProps extends React.SVGAttributes<SVGElement> {
  variant?: 'default' | 'inverse' | 'terracotta';
  size?: 'sm' | 'md' | 'lg';
}

const LogoCircle = React.forwardRef<SVGSVGElement, LogoCircleProps>(
  ({ variant = 'default', size = 'md', className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-10 h-10',
      md: 'w-12 h-12',
      lg: 'w-16 h-16',
    };

    const colors = {
      default: { bg: '#3D5A4C', text: '#F4EFE6', ring: '#F4EFE6' },
      inverse: { bg: '#F4EFE6', text: '#3D5A4C', ring: '#3D5A4C' },
      terracotta: { bg: '#B96D4B', text: '#FFFFFF', ring: '#FFFFFF' },
    };

    const { bg, text, ring } = colors[variant];

    return (
      <svg
        ref={ref}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizeClasses[size], className)}
        {...props}
      >
        <circle cx="32" cy="32" r="32" fill={bg} />
        <circle cx="32" cy="32" r="28" fill="none" stroke={ring} strokeWidth="1" opacity="0.3" />
        <path
          d="M44 16H16v32h28v-8H24V24h20V16z"
          fill={text}
        />
      </svg>
    );
  }
);
LogoCircle.displayName = 'LogoCircle';

export { LogoSymbol, LogoFull, LogoCircle };
