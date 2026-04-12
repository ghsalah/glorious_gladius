/**
 * Password field with an accessible show/hide toggle.
 */
import { useId, useState } from 'react'

type PasswordInputProps = {
  id?: string
  label: string
  labelClassName?: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  required?: boolean
  minLength?: number
  /** Classes for the text input (include pr-11 when using default layout). */
  inputClassName: string
}

export function PasswordInput({
  id: idProp,
  label,
  labelClassName = 'mb-1 block text-sm font-medium text-slate-700',
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  inputClassName,
}: PasswordInputProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}
