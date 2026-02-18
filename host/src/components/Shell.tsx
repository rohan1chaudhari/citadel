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
    <div className="space-y-6">
      <header className="space-y-1">
        {!hideBrand ? <p className="text-xs font-medium text-zinc-500">Citadel</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle ? <p className="text-sm text-zinc-600">{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}

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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15 ${
        props.className ?? ''
      }`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/15 ${
        props.className ?? ''
      }`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="text-xs font-medium text-zinc-700">{children}</label>;
}

export function LinkA(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={`text-sm text-zinc-700 hover:text-zinc-900 ${props.className ?? ''}`} />;
}
