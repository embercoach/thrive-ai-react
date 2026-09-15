import type { InputHTMLAttributes } from "react";
import { Input } from "./Input";

interface DecimalInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onChange" | "value"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Drop-in replacement for `<Input type="number">` on money/decimal fields.
 *
 * type="number" seems like the obvious choice for these, but it has a
 * footgun that isn't obvious until a user hits it: the browser renders the
 * field's *displayed* text using the OS/browser locale's decimal separator
 * (e.g. "1,23" instead of "1.23" on a comma-locale system), even though the
 * underlying DOM value and validity model stay period-based. The stored
 * amount is correct and every other view of it (list rows, totals, exports)
 * shows it correctly — only this input's own display is wrong — which makes
 * it look like the data itself is corrupted when it isn't.
 *
 * type="text" + inputMode="decimal" sidesteps that entirely: the displayed
 * text is always exactly what's in state (always period-based, matching
 * parseFloat/toFixed elsewhere in the app), while inputMode still gives
 * mobile users a numeric keyboard. The onChange filter below keeps the
 * field from becoming free text in practice — it only ever accepts digits
 * and a single optional decimal point, silently ignoring any keystroke that
 * wouldn't be valid input for a decimal amount (rather than accepting it
 * and only failing later at parseFloat/submit time).
 */
export function DecimalInput({ value, onChange, ...rest }: DecimalInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "" || /^\d*\.?\d*$/.test(next)) {
          onChange(next);
        }
      }}
      {...rest}
    />
  );
}
