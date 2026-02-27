import type { ReactNode } from 'react';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${className ?? ''}`}>{children}</div>;
}

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  className,
  ...props
}: {
  children: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger';
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-zinc-900/15 disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-zinc-900 text-white hover:bg-zinc-800'
      : variant === 'danger'
        ? 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
        : 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50';
  return (
    <button type={type} className={`${base} ${styles} ${className ?? ''}`} {...props}>
      {children}
    </button>
  );
}
