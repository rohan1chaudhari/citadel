import type { ReactNode } from 'react';

export function Shell({
  title,
  subtitle,
  children,
  hideBrand = false
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  hideBrand?: boolean;
}) {
  return (
    <div className="w-full min-w-0 space-y-3 sm:space-y-4 md:space-y-6 px-2 sm:px-4 lg:px-6 py-3 sm:py-4 md:py-6">
      <header className="space-y-1">
        {!hideBrand ? <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Citadel</p> : null}
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h1>
        {subtitle ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm ${className ?? ''}`}>{children}</div>;
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
    'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-zinc-100/15 disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
      : variant === 'danger'
        ? 'bg-white dark:bg-zinc-900 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950'
        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800';
  return (
    <button type={type} className={`${base} ${styles} ${className ?? ''}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-zinc-100/15 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 ${
        props.className ?? ''
      }`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-zinc-100/15 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 ${
        props.className ?? ''
      }`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{children}</label>;
}

export function LinkA(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={`text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 ${props.className ?? ''}`} />;
}
