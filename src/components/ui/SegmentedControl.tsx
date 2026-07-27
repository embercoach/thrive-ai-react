interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex bg-surface-sunken rounded-full p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 text-sm font-semibold rounded-full cursor-pointer transition-colors ${
            value === opt.value ? "bg-brand text-ink-on-brand" : "text-ink-secondary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
