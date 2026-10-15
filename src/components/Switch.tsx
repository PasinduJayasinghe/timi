type SwitchProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** On/off switch from Settings (4e): 40 x 24 track, 18px knob, in a 44 x 32 target. */
export function Switch({ checked, label, onChange, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onChange(!checked);
      }}
      className="grid h-8 w-11 shrink-0 place-items-center rounded-lg focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-50"
    >
      <span
        className={`relative h-6 w-10 rounded-[12px] transition-[background-color] duration-200 ${
          checked ? "bg-accent-gradient-strong" : "bg-ink-muted/30"
        }`}
      >
        <span
          className={`absolute top-0.75 size-4.5 rounded-full bg-white shadow-knob transition-[left] duration-250 ease-spring ${
            checked ? "left-[19px]" : "left-0.75"
          }`}
        />
      </span>
    </button>
  );
}
