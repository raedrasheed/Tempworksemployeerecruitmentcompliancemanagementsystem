import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Plus, Trash2, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { settingsApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';

// Centralised set of every vehicle lookup list shown on this page. The
// short keys must match the backend (settings.service.ts → VEHICLE_LOOKUP_KEYS).
// Sections group them by where they appear on the Vehicle form so the
// admin UX matches the data-entry UX.
type LookupKey =
  | 'statuses' | 'fuelTypes' | 'documentTypes' | 'insuranceTypes' | 'euroEmissionClasses'
  | 'bodyTypes' | 'hitchTypes'
  | 'tankMaterials' | 'adrClasses'
  | 'vinSubTypes' | 'insuranceGroups';

interface LookupDef {
  key:         LookupKey;
  label:       string;
  description: string;
  placeholder: string;
}

interface SectionDef {
  id:    string;
  label: string;
  desc:  string;
  items: LookupDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'common',
    label: 'Common',
    desc: 'Lookup lists that appear on every vehicle profile',
    items: [
      { key: 'statuses',            label: 'Vehicle Statuses',     description: 'Statuses available in the vehicle profile', placeholder: 'e.g. Rented' },
      { key: 'fuelTypes',           label: 'Fuel Types',           description: 'Fuel types selectable on the vehicle form',  placeholder: 'e.g. Hydrogen' },
      { key: 'insuranceTypes',      label: 'Insurance Types',      description: 'Insurance type values (Comprehensive, …)',   placeholder: 'e.g. Goods in Transit' },
      { key: 'documentTypes',       label: 'Vehicle Document Types', description: 'Used by the Documents tab on a vehicle',    placeholder: 'e.g. Inspection' },
      { key: 'euroEmissionClasses', label: 'Euro Emission Classes', description: 'Emission classes for trucks/trailers',      placeholder: 'e.g. Euro VI' },
    ],
  },
  {
    id: 'truck',
    label: 'Trucks & Trailers',
    desc: 'Lookups specific to trucks and trailer combinations',
    items: [
      { key: 'bodyTypes',  label: 'Body Types',         description: 'Flatbed, curtainsider, box, tipper, …',                  placeholder: 'e.g. Walking Floor' },
      { key: 'hitchTypes', label: 'Trailer Hitch Types', description: '5th wheel, drawbar, pintle, …',                          placeholder: 'e.g. Goose Neck' },
    ],
  },
  {
    id: 'tanker',
    label: 'Tanker',
    desc: 'Tanker-only lookup lists',
    items: [
      { key: 'tankMaterials', label: 'Tank Materials', description: 'Stainless steel, aluminium, …',                placeholder: 'e.g. Carbon Steel' },
      { key: 'adrClasses',    label: 'ADR Classes',    description: 'Hazardous-goods classification (1–9)',         placeholder: 'e.g. 3 Flammable Liquids' },
    ],
  },
  {
    id: 'car',
    label: 'Cars',
    desc: 'Lookups used on the Car form',
    items: [
      { key: 'vinSubTypes',     label: 'VIN Sub-types',    description: 'Saloon, hatchback, SUV, …',                  placeholder: 'e.g. Coupe' },
      { key: 'insuranceGroups', label: 'Insurance Groups', description: 'Insurance group identifiers',                placeholder: 'e.g. 30' },
    ],
  },
];

/** Inline list editor — input + chips with remove buttons. */
function LookupListEditor({
  def,
  values,
  onChange,
  canEdit,
}: {
  def:      LookupDef;
  values:   string[];
  onChange: (next: string[]) => void;
  canEdit:  boolean;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This value already exists');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  return (
    <Card className="border-blue-100">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {def.label}
          <Badge variant="outline" className="font-normal text-xs">{values.length}</Badge>
        </CardTitle>
        <CardDescription>{def.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <div className="flex gap-2">
            <Input
              placeholder={def.placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            />
            <Button type="button" onClick={add} className="gap-1.5"><Plus className="w-4 h-4" /> Add</Button>
          </div>
        )}
        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
            No values defined — vehicle forms will show an empty dropdown.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-muted text-sm border">
                {v}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    className="text-muted-foreground hover:text-red-500"
                    aria-label={`Remove ${v}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VehicleSettings() {
  const { canEdit } = usePermissions();
  const isAdmin = canEdit('settings');
  const [data, setData] = useState<Record<LookupKey, string[]> | null>(null);
  const [original, setOriginal] = useState<Record<LookupKey, string[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    settingsApi.getVehicleSettings()
      .then((res) => {
        const safe: any = {};
        SECTIONS.flatMap((s) => s.items).forEach((d) => {
          safe[d.key] = Array.isArray((res as any)[d.key]) ? (res as any)[d.key] : [];
        });
        setData(safe);
        setOriginal(JSON.parse(JSON.stringify(safe)));
      })
      .catch(() => toast.error('Failed to load vehicle settings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const dirtyKeys = (() => {
    if (!data || !original) return [] as LookupKey[];
    const out: LookupKey[] = [];
    for (const def of SECTIONS.flatMap((s) => s.items)) {
      const a = data[def.key] ?? [];
      const b = original[def.key] ?? [];
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) out.push(def.key);
    }
    return out;
  })();

  const setList = (key: LookupKey) => (next: string[]) => {
    setData((d) => (d ? { ...d, [key]: next } : d));
  };

  const handleSave = async () => {
    if (!data || dirtyKeys.length === 0) return;
    setSaving(true);
    try {
      // Sequential saves keep the audit log per-list and surface a clear
      // error if one specific list rejects (e.g. validation later on).
      for (const key of dirtyKeys) {
        await settingsApi.updateVehicleSetting(key, data[key]);
      }
      toast.success(`Saved ${dirtyKeys.length} list${dirtyKeys.length === 1 ? '' : 's'}`);
      setOriginal(JSON.parse(JSON.stringify(data)));
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return <div className="text-center py-16 text-muted-foreground">Access denied.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/settings"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-600" /> Vehicle Settings
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Centralised configuration for every editable list shown on the vehicle form
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || dirtyKeys.length === 0} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : dirtyKeys.length > 0 ? `Save ${dirtyKeys.length} change${dirtyKeys.length === 1 ? '' : 's'}` : 'No changes'}
        </Button>
      </div>

      {loading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Tabs defaultValue="common" className="w-full">
          <TabsList className="flex flex-wrap gap-1">
            {SECTIONS.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
            ))}
          </TabsList>

          {SECTIONS.map((s) => (
            <TabsContent key={s.id} value={s.id} className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {s.items.map((def) => (
                  <LookupListEditor
                    key={def.key}
                    def={def}
                    values={data[def.key] ?? []}
                    onChange={setList(def.key)}
                    canEdit
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
