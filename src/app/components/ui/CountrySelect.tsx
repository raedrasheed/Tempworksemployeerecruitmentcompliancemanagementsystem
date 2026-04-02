/** Reusable country dropdown. Uses the centralized COUNTRIES list.
 *  All country selects across the site should use this component.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { COUNTRIES } from '../../data/countries';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function CountrySelect({ value, onChange, placeholder = 'Select country', required, className, disabled }: Props) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64 overflow-y-auto">
        {!required && (
          <SelectItem value="">— None —</SelectItem>
        )}
        {COUNTRIES.map(c => (
          <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
