import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  ComponentType,
} from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { fieldControlClass, fieldLabelClass } from '@/components/ui/formStyles';

interface FieldShellProps {
  label: string;
  className?: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  error?: string | null;
  children: ReactNode;
}

function FieldShell({
  label,
  className,
  htmlFor,
  hint,
  required,
  optional,
  error,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('group/field block', className)}>
      <div className={cn(fieldLabelClass, 'mb-1.5')}>
        <label htmlFor={htmlFor} className="flex items-center gap-1 cursor-pointer font-medium text-[var(--color-ink)]">
          <span>{label}</span>
          {required ? (
            <span className="text-[var(--color-danger)] text-sm leading-none font-bold" title="Required">
              *
            </span>
          ) : optional ? (
            <span className="text-[10px] font-normal text-[var(--color-muted)] tracking-normal">
              (optional)
            </span>
          ) : null}
        </label>
      </div>
      <div className="relative">{children}</div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-danger)] font-medium animate-fade-in">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] leading-normal text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

interface FieldProps {
  label: string;
  className?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  icon?: ComponentType<{ size?: number; className?: string }>;
}

export function Input({
  label,
  className,
  id,
  type,
  hint,
  required,
  error,
  optional,
  icon: Icon,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  if (type === 'date' || type === 'time' || type === 'datetime-local') {
    throw new Error('Use DatePicker / TimePicker instead of native date/time inputs');
  }
  const inputId = id ?? props.name ?? label;
  return (
    <FieldShell
      label={label}
      className={className}
      htmlFor={inputId}
      hint={hint}
      required={required}
      optional={optional}
      error={error}
    >
      <div className="relative flex items-center">
        {Icon ? (
          <div className="pointer-events-none absolute left-3.5 flex items-center text-[var(--color-muted)] transition-colors group-focus-within/field:text-[var(--color-primary)]">
            <Icon size={16} />
          </div>
        ) : null}
        <input
          id={inputId}
          type={type}
          required={required}
          className={cn(
            fieldControlClass,
            Icon && 'pl-10',
            error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/15',
          )}
          {...props}
        />
      </div>
    </FieldShell>
  );
}

export function Select({
  label,
  className,
  id,
  children,
  hint,
  required,
  error,
  optional,
  icon: Icon,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const selectId = id ?? props.name ?? label;
  return (
    <FieldShell
      label={label}
      className={className}
      htmlFor={selectId}
      hint={hint}
      required={required}
      optional={optional}
      error={error}
    >
      <div className="relative flex items-center">
        {Icon ? (
          <div className="pointer-events-none absolute left-3.5 flex items-center text-[var(--color-muted)] transition-colors group-focus-within/field:text-[var(--color-primary)]">
            <Icon size={16} />
          </div>
        ) : null}
        <select
          id={selectId}
          required={required}
          className={cn(
            fieldControlClass,
            'appearance-none pr-10 cursor-pointer',
            Icon && 'pl-10',
            error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/15',
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 flex items-center text-[var(--color-muted)]">
          <ChevronDown size={16} />
        </div>
      </div>
    </FieldShell>
  );
}

export function Textarea({
  label,
  className,
  id,
  hint,
  required,
  error,
  optional,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const areaId = id ?? props.name ?? label;
  return (
    <FieldShell
      label={label}
      className={className}
      htmlFor={areaId}
      hint={hint}
      required={required}
      optional={optional}
      error={error}
    >
      <textarea
        id={areaId}
        required={required}
        className={cn(
          fieldControlClass,
          'h-auto min-h-[5.5rem] resize-y py-2.5 leading-relaxed',
          error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/15',
        )}
        {...props}
      />
    </FieldShell>
  );
}

