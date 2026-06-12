/**
 * Shared UI primitives for the redesign. Class-driven, brand-token based.
 * Keep these dumb — no data fetching, no app logic.
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-strong shadow-sm disabled:bg-brand/50',
  secondary:
    'border border-brand/30 bg-brand-tint text-brand-strong hover:bg-brand-soft disabled:opacity-50',
  ghost:
    'border border-border bg-surface text-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-50',
  danger:
    'border border-danger/30 bg-danger/5 text-danger hover:bg-danger/10 disabled:opacity-50',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors cursor-pointer',
        'disabled:cursor-not-allowed [&_svg]:shrink-0',
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]',
        interactive && 'transition-shadow transition-transform hover:shadow-[var(--shadow-lift)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- Chip */

type ChipTone = 'neutral' | 'brand' | 'protein' | 'carbs' | 'fat' | 'warning' | 'danger';

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-surface-sunken text-muted',
  brand: 'bg-brand-soft text-brand-strong',
  protein: 'bg-protein/10 text-protein',
  carbs: 'bg-carbs/15 text-[#9a6b16]',
  fat: 'bg-fat/15 text-fat',
  warning: 'bg-warning/15 text-[#9a6b16]',
  danger: 'bg-danger/10 text-danger',
};

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

export function Chip({ tone = 'neutral', className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        CHIP_TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- Stat */

interface StatProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function Stat({ label, value, icon, className }: StatProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {icon && <span className="text-faint">{icon}</span>}
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div className="text-sm font-semibold text-ink">{value}</div>
      </div>
    </div>
  );
}
