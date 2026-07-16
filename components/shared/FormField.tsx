import type { ReactNode } from 'react';

type FormFieldProps = {
  label: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  labelClassName?: string;
};

export default function FormField({
  label,
  children,
  action,
  hint,
  required = false,
  className = '',
  labelClassName = '',
}: FormFieldProps) {
  return (
    <div className={className}>
      <div className={`form-field-heading ${labelClassName}`}>
        <label className="form-field-label">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
        {action}
      </div>
      {children}
      {hint ? <div className="form-field-hint">{hint}</div> : null}
    </div>
  );
}
