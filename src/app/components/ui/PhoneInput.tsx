/** Phone field with a country-dial-code dropdown.
 *  The component works on a single phone string (e.g. "+44 20 7123 4567")
 *  and splits/joins it against the known dial codes so the caller only
 *  sees one string value — no schema change required.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Input } from './input';
import { PHONE_CODES, splitPhone } from '../../data/phoneCodes';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  /** Dial code to use when the value has none. Default is empty so the
   *  user is forced to pick one — same convention used everywhere else
   *  on the site. Pass e.g. '+44' to keep a UK pre-selection. */
  defaultCode?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = 'e.g. 20 7123 4567',
  disabled,
  required,
  id,
  className,
  defaultCode = '',
}: Props) {
  const { code, number } = splitPhone(value);
  const activeCode = code || defaultCode;
  const hasCode = !!activeCode;
  const iso = PHONE_CODES.find(p => p.code === activeCode)?.iso ?? '';

  const commit = (nextCode: string, nextNumber: string) => {
    const n = nextNumber.trim();
    onChange(n ? `${nextCode} ${n}` : nextCode);
  };

  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      <Select
        value={activeCode}
        onValueChange={(c) => commit(c, number)}
        disabled={disabled}
      >
        <SelectTrigger className="w-32 shrink-0">
          {hasCode ? (
            <span className="inline-flex items-center gap-2">
              {iso && (
                <img
                  src={`https://flagcdn.com/w20/${iso.toLowerCase()}.png`}
                  width={20}
                  height={15}
                  alt=""
                  className="inline-block rounded-sm"
                />
              )}
              {activeCode}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Code</span>
          )}
        </SelectTrigger>
        <SelectContent className="max-h-64 overflow-y-auto">
          {PHONE_CODES.map(c => (
            <SelectItem key={`${c.iso}-${c.code}`} value={c.code}>
              <span className="inline-flex items-center gap-2">
                <img
                  src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`}
                  width={20}
                  height={15}
                  alt=""
                  className="inline-block rounded-sm"
                />
                <span className="font-mono text-xs w-12">{c.code}</span>
                <span className="text-muted-foreground">{c.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => commit(activeCode, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="flex-1"
      />
    </div>
  );
}
