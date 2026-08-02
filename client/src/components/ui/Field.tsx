import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-teal-500/20';

interface FieldProps {
  label: string;
  className?: string;
}

export function Input({
  label,
  className,
  id,
  type,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  if (type === 'date' || type === 'time' || type === 'datetime-local') {
    throw new Error('Use DatePicker / TimePicker instead of native date/time inputs');
  }
  const inputId = id ?? props.name ?? label;
  return (
    <label className={cn('block text-sm font-medium text-[var(--color-ink)]', className)} htmlFor={inputId}>
      {label}
      <input id={inputId} type={type} className={fieldClass} {...props} />
    </label>
  );
}

export function Select({
  label,
  className,
  id,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const selectId = id ?? props.name ?? label;
  return (
    <label className={cn('block text-sm font-medium text-[var(--color-ink)]', className)} htmlFor={selectId}>
      {label}
      <select id={selectId} className={fieldClass} {...props}>
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  label,
  className,
  id,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const areaId = id ?? props.name ?? label;
  return (
    <label className={cn('block text-sm font-medium text-[var(--color-ink)]', className)} htmlFor={areaId}>
      {label}
      <textarea id={areaId} className={cn(fieldClass, 'min-h-24 resize-y')} {...props} />
    </label>
  );
}
