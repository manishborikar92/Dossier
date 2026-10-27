// Class-name helpers that are safe to use from both server and client components.
export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';
const BUTTON_VARIANT = {
  primary: 'bg-brand text-white shadow-xs hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink shadow-xs hover:bg-sunken',
  ghost: 'text-ink-2 hover:bg-brand-soft hover:text-brand',
  danger: 'bg-bad text-white shadow-xs hover:bg-[#8f1d14]',
  'danger-ghost': 'text-bad hover:bg-bad-soft',
} as const;
const BUTTON_SIZE = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-sm' } as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT;
export type ButtonSize = keyof typeof BUTTON_SIZE;

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size]);
}

/** Shared look of text inputs, selects and text areas. */
export const CONTROL_CLASS =
  'block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15 disabled:bg-sunken disabled:text-muted';
