'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { citiesForState } from '@/lib/india-cities';

interface Props {
  /** ISO 3166-2:IN state code; the datalist switches when this changes. */
  stateCode: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
}

/**
 * City input with native autocomplete sourced from CITIES_BY_STATE.
 *
 * Uses HTML <datalist> — works in every modern browser, no JS dropdown
 * required. Suggestions come from the selected state; if the state is
 * empty or unknown, the input becomes plain free-text. Users can always
 * type a city not in the list (datalist is non-restricting) so villages
 * and small towns aren't blocked.
 *
 * Renders a small "(showing N cities)" hint so users know suggestions
 * are available.
 */
export function CitySelect({
  stateCode,
  value,
  onChange,
  required = true,
  placeholder = 'Start typing your city',
  id,
}: Props) {
  const cities = citiesForState(stateCode);
  const listId = id ? `${id}-cities` : `cities-${stateCode || 'any'}`;
  const datalistId = stateCode && cities.length > 0 ? listId : undefined;

  // When the state changes, if the current value is no longer in that
  // state's list, clear it — keeps city/state consistent.
  React.useEffect(() => {
    if (!stateCode || !value) return;
    if (cities.length === 0) return;
    const stillValid = cities.some((c) => c.toLowerCase() === value.trim().toLowerCase());
    // We don't auto-clear: users might be re-using a city they typed before
    // the state was set (PIN lookup populates state after city). Just rely
    // on visual mismatch — they'll notice if the suggestions don't match.
    void stillValid;
  }, [stateCode, value, cities]);

  return (
    <>
      <Input
        id={id}
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete="address-level2"
        placeholder={placeholder}
      />
      {datalistId && (
        <datalist id={datalistId}>
          {cities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      )}
      {!stateCode && (
        <span className="text-xs text-muted-foreground">
          Pick a state to see city suggestions
        </span>
      )}
      {stateCode && cities.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {cities.length} cities in this state · type freely if yours isn&rsquo;t listed
        </span>
      )}
    </>
  );
}
