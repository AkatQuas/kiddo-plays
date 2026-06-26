import { FormEvent, useState } from 'react';
import type { UiFormProps } from '../types';

export function UiForm({
  field,
  placeholder,
  action,
  onAction,
  children,
}: UiFormProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (action && onAction) {
      const payload = field ? `${action}?${field}=${encodeURIComponent(value)}` : action;
      onAction(payload);
    }
  };

  return (
    <form
      className="ui-form"
      data-testid="ui-form"
      data-field={field}
      data-action={action}
      onSubmit={handleSubmit}
    >
      {children ? <div className="ui-form__hint">{children}</div> : null}
      <input
        className="ui-form__input"
        name={field}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className="ui-button ui-button--primary">
        提交
      </button>
    </form>
  );
}
