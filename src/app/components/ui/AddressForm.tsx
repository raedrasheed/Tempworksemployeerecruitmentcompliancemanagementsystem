/** Reusable structured address block.
 *  Standard address format used across the entire site:
 *    Address Line 1, Address Line 2, Country, City, Zip Code
 */
import { Label } from './label';
import { Input } from './input';
import { CountrySelect } from './CountrySelect';

export interface AddressData {
  line1: string;
  line2: string;
  country: string;
  city: string;
  zip: string;
}

export const EMPTY_ADDRESS: AddressData = { line1: '', line2: '', country: '', city: '', zip: '' };

interface Props {
  label?: string;
  value: AddressData;
  onChange: (data: AddressData) => void;
  required?: boolean;
  disabled?: boolean;
}

export function AddressForm({ label, value, onChange, required = false, disabled = false }: Props) {
  const set = (field: keyof AddressData) => (v: string) => onChange({ ...value, [field]: v });

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-semibold text-gray-700">{label}</p>}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Address Line 1{required && ' *'}</Label>
          <Input
            placeholder="Street address, building, apartment"
            value={value.line1}
            onChange={e => set('line1')(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Address Line 2</Label>
          <Input
            placeholder="Floor, suite, additional info (optional)"
            value={value.line2}
            onChange={e => set('line2')(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Country{required && ' *'}</Label>
          <CountrySelect value={value.country} onChange={set('country')} required={required} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">City{required && ' *'}</Label>
          <Input
            placeholder="City"
            value={value.city}
            onChange={e => set('city')(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Zip / Postal Code{required && ' *'}</Label>
          <Input
            placeholder="Zip / Postal Code"
            value={value.zip}
            onChange={e => set('zip')(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
