import Link from 'next/link';
import { cx } from '@/lib/client/cx';
import { Icon } from './Icon.js';

/**
 * variant: primary | secondary | ghost | danger   size: md | sm
 * Pass `href` for navigation (internal) or downloads (/api/..., `download`, `external`).
 * Icon-only buttons (no children) must pass aria-label.
 */
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, loading, href, download, external, className, children, type = 'button', ...rest }) {
  const cls = cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', !children && 'btn--icon', className);
  const iconSize = size === 'sm' ? 15 : 17;
  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={15} /> : null}
    </>
  );
  if (href) {
    if (download || external || href.startsWith('/api/')) {
      return <a className={cls} href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} {...rest}>{content}</a>;
    }
    return <Link className={cls} href={href} {...rest}>{content}</Link>;
  }
  return <button type={type} className={cls} {...rest} disabled={rest.disabled || loading}>{content}</button>;
}
