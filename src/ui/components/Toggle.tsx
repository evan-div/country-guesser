export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center justify-between gap-4 py-3 ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-[15px] font-medium text-white">{label}</span>
        {description && <span className="block text-xs text-haze">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-glow/80' : 'bg-white/12'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </button>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="py-3">
      <div className="mb-2 text-[15px] font-medium text-white">{label}</div>
      <div className="flex gap-1 rounded-xl bg-white/[0.05] p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`h-9 flex-1 rounded-lg text-[13px] font-semibold transition ${
              value === o.value ? 'bg-glow/90 text-ink-950 shadow' : 'text-haze hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
