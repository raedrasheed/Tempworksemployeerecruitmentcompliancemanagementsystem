import { useState } from 'react';
import { Filter, X, Plus, Save, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

export type DataType = 'text' | 'number' | 'date' | 'enum' | 'boolean';

export interface Column {
  id: string;
  label: string;
  type: DataType;
  options?: string[]; // For enum types
}

export type TextOperator = 'contains' | 'equals' | 'startsWith' | 'endsWith';
export type NumberOperator = 'equals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'between';
export type DateOperator = 'before' | 'after' | 'between';
export type EnumOperator = 'equals' | 'notEquals' | 'in';
export type BooleanOperator = 'equals';

export type Operator = TextOperator | NumberOperator | DateOperator | EnumOperator | BooleanOperator;

export interface FilterRule {
  id: string;
  columnId: string;
  operator: Operator;
  value: any;
  value2?: any; // For 'between' operators
}

export interface FilterPreset {
  id: string;
  name: string;
  rules: FilterRule[];
  logic: 'AND' | 'OR';
}

interface FilterSystemProps {
  columns: Column[];
  activeFilters: FilterRule[];
  onFiltersChange: (filters: FilterRule[]) => void;
  filterLogic?: 'AND' | 'OR';
  onLogicChange?: (logic: 'AND' | 'OR') => void;
  savedPresets?: FilterPreset[];
  onSavePreset?: (name: string, rules: FilterRule[], logic: 'AND' | 'OR') => void;
  onLoadPreset?: (preset: FilterPreset) => void;
  onDeletePreset?: (presetId: string) => void;
}

export function FilterSystem({
  columns,
  activeFilters,
  onFiltersChange,
  filterLogic = 'AND',
  onLogicChange,
  savedPresets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: FilterSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchColumn, setSearchColumn] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const getOperatorsForType = (type: DataType): { value: Operator; label: string }[] => {
    switch (type) {
      case 'text':
        return [
          { value: 'contains', label: 'Contains' },
          { value: 'equals', label: 'Equals' },
          { value: 'startsWith', label: 'Starts with' },
          { value: 'endsWith', label: 'Ends with' },
        ];
      case 'number':
        return [
          { value: 'equals', label: '=' },
          { value: 'greaterThan', label: '>' },
          { value: 'lessThan', label: '<' },
          { value: 'greaterThanOrEqual', label: '>=' },
          { value: 'lessThanOrEqual', label: '<=' },
          { value: 'between', label: 'Between' },
        ];
      case 'date':
        return [
          { value: 'before', label: 'Before' },
          { value: 'after', label: 'After' },
          { value: 'between', label: 'Between' },
        ];
      case 'enum':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'notEquals', label: 'Not Equals' },
          { value: 'in', label: 'In List' },
        ];
      case 'boolean':
        return [{ value: 'equals', label: 'Is' }];
      default:
        return [];
    }
  };

  const addFilter = () => {
    const newFilter: FilterRule = {
      id: Date.now().toString(),
      columnId: columns[0]?.id || '',
      operator: getOperatorsForType(columns[0]?.type || 'text')[0].value,
      value: '',
    };
    onFiltersChange([...activeFilters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    onFiltersChange(
      activeFilters.map((filter) =>
        filter.id === id ? { ...filter, ...updates } : filter
      )
    );
  };

  const removeFilter = (id: string) => {
    onFiltersChange(activeFilters.filter((filter) => filter.id !== id));
  };

  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  const handleSavePreset = () => {
    if (presetName && onSavePreset) {
      onSavePreset(presetName, activeFilters, filterLogic);
      setPresetName('');
      setShowSaveDialog(false);
    }
  };

  const filteredColumns = columns.filter((col) =>
    col.label.toLowerCase().includes(searchColumn.toLowerCase())
  );

  const getColumnLabel = (columnId: string) => {
    return columns.find((c) => c.id === columnId)?.label || columnId;
  };

  const getOperatorLabel = (operator: Operator) => {
    const allOperators = [
      ...getOperatorsForType('text'),
      ...getOperatorsForType('number'),
      ...getOperatorsForType('date'),
      ...getOperatorsForType('enum'),
    ];
    return allOperators.find((op) => op.value === operator)?.label || operator;
  };

  const formatFilterValue = (filter: FilterRule) => {
    if (filter.operator === 'between') {
      return `${filter.value} - ${filter.value2}`;
    }
    const column = columns.find((c) => c.id === filter.columnId);
    if (column?.type === 'boolean') {
      return filter.value ? 'Yes' : 'No';
    }
    return filter.value;
  };

  return (
    <div className="relative">
      {/* Filter Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Filter className="w-4 h-4" />
        Filters
        {activeFilters.length > 0 && (
          <Badge className="ml-1 bg-[#2563EB] text-white">
            {activeFilters.length}
          </Badge>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Filter Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 mt-2 w-[600px] max-h-[600px] overflow-auto z-50 shadow-lg">
          <CardContent className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-semibold text-[#0F172A]">Filter Rules</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Saved Presets */}
            {savedPresets.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Saved Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {savedPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center gap-1 px-3 py-1 bg-[#EFF6FF] border border-[#2563EB] rounded-md"
                    >
                      <button
                        onClick={() => onLoadPreset?.(preset)}
                        className="text-sm font-medium text-[#2563EB] hover:underline"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => onDeletePreset?.(preset.id)}
                        className="text-[#2563EB] hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Columns */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Search Columns</Label>
              <Input
                placeholder="Search column name..."
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
              />
            </div>

            {/* Filter Logic Toggle */}
            {activeFilters.length > 1 && onLogicChange && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Logic:</Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={filterLogic === 'AND' ? 'default' : 'outline'}
                    onClick={() => onLogicChange('AND')}
                  >
                    AND
                  </Button>
                  <Button
                    size="sm"
                    variant={filterLogic === 'OR' ? 'default' : 'outline'}
                    onClick={() => onLogicChange('OR')}
                  >
                    OR
                  </Button>
                </div>
              </div>
            )}

            {/* Active Filters */}
            <div className="space-y-3">
              {activeFilters.map((filter, index) => {
                const column = columns.find((c) => c.id === filter.columnId);
                if (!column) return null;

                return (
                  <div key={filter.id} className="space-y-2">
                    {index > 0 && (
                      <div className="text-xs font-medium text-muted-foreground text-center">
                        {filterLogic}
                      </div>
                    )}
                    <FilterRuleBuilder
                      rule={filter}
                      columns={filteredColumns}
                      onUpdate={(updates) => updateFilter(filter.id, updates)}
                      onRemove={() => removeFilter(filter.id)}
                      getOperatorsForType={getOperatorsForType}
                    />
                  </div>
                );
              })}
            </div>

            {/* Add Filter Button */}
            <Button
              variant="outline"
              onClick={addFilter}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Filter
            </Button>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t">
              {activeFilters.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-red-600"
                  >
                    Clear All
                  </Button>
                  {onSavePreset && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSaveDialog(true)}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Preset
                    </Button>
                  )}
                </>
              )}
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="ml-auto"
              >
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Save Filter Preset</h3>
              <div className="space-y-2">
                <Label>Preset Name</Label>
                <Input
                  placeholder="e.g., Senior Drivers EU"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePreset} className="flex-1">
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Filter Tags (Below the button) */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.id}
              variant="outline"
              className="px-3 py-1 bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] gap-2"
            >
              <span className="font-medium">{getColumnLabel(filter.columnId)}:</span>
              <span>{getOperatorLabel(filter.operator)}</span>
              <span className="font-semibold">{formatFilterValue(filter)}</span>
              <button
                onClick={() => removeFilter(filter.id)}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 text-xs text-red-600"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}

// Filter Rule Builder Component
interface FilterRuleBuilderProps {
  rule: FilterRule;
  columns: Column[];
  onUpdate: (updates: Partial<FilterRule>) => void;
  onRemove: () => void;
  getOperatorsForType: (type: DataType) => { value: Operator; label: string }[];
}

function FilterRuleBuilder({
  rule,
  columns,
  onUpdate,
  onRemove,
  getOperatorsForType,
}: FilterRuleBuilderProps) {
  const column = columns.find((c) => c.id === rule.columnId);
  const operators = column ? getOperatorsForType(column.type) : [];

  const handleColumnChange = (columnId: string) => {
    const newColumn = columns.find((c) => c.id === columnId);
    if (newColumn) {
      const newOperators = getOperatorsForType(newColumn.type);
      onUpdate({
        columnId,
        operator: newOperators[0].value,
        value: '',
        value2: undefined,
      });
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg bg-[#F8FAFC]">
      {/* Column Select */}
      <Select value={rule.columnId} onValueChange={handleColumnChange}>
        <SelectTrigger className="w-[180px] bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((col) => (
            <SelectItem key={col.id} value={col.id}>
              {col.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Select */}
      <Select
        value={rule.operator}
        onValueChange={(value) => onUpdate({ operator: value as Operator })}
      >
        <SelectTrigger className="w-[120px] bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input */}
      {column?.type === 'enum' ? (
        <Select value={rule.value} onValueChange={(value) => onUpdate({ value })}>
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {column.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : column?.type === 'boolean' ? (
        <Select
          value={rule.value?.toString()}
          onValueChange={(value) => onUpdate({ value: value === 'true' })}
        >
          <SelectTrigger className="flex-1 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      ) : column?.type === 'date' ? (
        <>
          <Input
            type="date"
            value={rule.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="flex-1 bg-white"
          />
          {rule.operator === 'between' && (
            <>
              <span className="text-sm text-muted-foreground">and</span>
              <Input
                type="date"
                value={rule.value2 || ''}
                onChange={(e) => onUpdate({ value2: e.target.value })}
                className="flex-1 bg-white"
              />
            </>
          )}
        </>
      ) : column?.type === 'number' ? (
        <>
          <Input
            type="number"
            value={rule.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            className="flex-1 bg-white"
            placeholder="Value"
          />
          {rule.operator === 'between' && (
            <>
              <span className="text-sm text-muted-foreground">and</span>
              <Input
                type="number"
                value={rule.value2 || ''}
                onChange={(e) => onUpdate({ value2: e.target.value })}
                className="flex-1 bg-white"
                placeholder="Value"
              />
            </>
          )}
        </>
      ) : (
        <Input
          value={rule.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="flex-1 bg-white"
          placeholder="Value"
        />
      )}

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-red-600"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
