/** Reusable country dropdown. Uses the centralized COUNTRIES list.
 *  All country selects across the site should use this component.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { COUNTRIES, getFlagEmoji } from '../../data/countries';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

const NONE_VALUE = '__none__';

export function CountrySelect({ value, onChange, placeholder = 'Select country', required, className, disabled }: Props) {
  const selectValue = value === '' ? NONE_VALUE : value;
  const handleChange = (v: string) => onChange(v === NONE_VALUE ? '' : v);

  return (
    <Select value={selectValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64 overflow-y-auto">
        {!required && (
          <SelectItem value={NONE_VALUE}>— None —</SelectItem>
        )}
        {COUNTRIES.map(c => (
          <SelectItem key={c.code} value={c.name}>
            <span className="flex items-center gap-2">
              <span>{getFlagEmoji(c.code)}</span>
              <span>{c.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
