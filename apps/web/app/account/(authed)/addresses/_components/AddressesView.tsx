'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddressForm } from '@/components/account/AddressForm';
import { accountApi } from '@/lib/account-api';
import { stateName } from '@/lib/india-states';
import type { Address } from '@/lib/types';

export function AddressesView() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Address | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await accountApi.get<Address[]>('/api/addresses');
      setAddresses(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this address?')) return;
    try {
      await accountApi.del(`/api/addresses/${id}`);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (creating || editing) {
    return (
      <AddressForm
        initial={editing ?? undefined}
        onSaved={(saved) => {
          setCreating(false);
          setEditing(null);
          load();
          void saved;
        }}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>+ Add address</Button>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No saved addresses yet. Add one to speed up checkout.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{a.name}</p>
                    {a.isDefault && <Badge variant="success">Default</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a.addressLine}
                    {a.landmark && <>, {a.landmark}</>}
                    <br />
                    {a.city}, {stateName(a.state)} — {a.pincode}
                    <br />
                    {a.phone}
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
