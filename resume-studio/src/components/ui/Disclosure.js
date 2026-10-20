import { cx } from '@/lib/client/cx';
import { Icon } from './Icon.js';

/** Native <details> accordion: keyboard and screen-reader friendly with no JavaScript. */
export function Disclosure({ title, count, defaultOpen = false, children, className }) {
  return (
    <details className={cx('disc', className)} open={defaultOpen}>
      <summary className="disc__sum">
        <Icon name="chevron-right" size={16} className="disc__chev" />
        <span className="disc__title">{title}</span>
        {count != null && count !== '' && <span className="disc__count">{count}</span>}
      </summary>
      <div className="disc__body">{children}</div>
    </details>
  );
}
