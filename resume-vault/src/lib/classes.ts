// Class-name helpers that are safe to use from both server and client components.
export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON_VARIANT = {
  primary: 'bg-navy text-white hover:bg-navy-deep',
  secondary: 'border border-rule bg-surface text-ink hover:bg-navy-soft',
  ghost: 'text-ink hover:bg-navy-soft',
  danger: 'bg-bad text-white hover:bg-[#861d23]',
} as const;
const BUTTON_SIZE = { sm: 'px-2.5 py-1 text-[13px]', md: 'px-3.5 py-2 text-sm' } as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT;
export type ButtonSize = keyof typeof BUTTON_SIZE;

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size]);
}
