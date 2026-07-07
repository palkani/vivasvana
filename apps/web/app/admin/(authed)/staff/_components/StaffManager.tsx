'use client';

import { useEffect, useState, useTransition } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/admin-api';
import { useAdminMe } from '../../_components/AdminMeProvider';
import type { Permission, StaffRole, UserRole } from '@/lib/admin-permissions';

interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  staffRole: StaffRole | null;
  roleLabel: string;
  permissions: Permission[];
  invitedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  invitedBy: { id: string; email: string; name: string | null } | null;
}

interface RoleDescription {
  label: string;
  summary: string;
}

interface ListResponse {
  items: StaffMember[];
  roles: Record<StaffRole, RoleDescription>;
}

const ROLE_ORDER: StaffRole[] = [
  'MANAGER',
  'ORDER_MANAGER',
  'SUPPORT',
  'CONTENT_EDITOR',
  'INVENTORY',
];

const PERMISSION_LABELS: Record<Permission, string> = {
  view_dashboard: 'Dashboard',
  view_reports: 'Reports',
  view_products: 'Products (view)',
  manage_products: 'Products (edit)',
  view_orders: 'Orders (view)',
  manage_orders: 'Orders (process)',
  view_customers: 'Customers (view)',
  manage_customers: 'Customers (edit)',
  view_discounts: 'Discounts (view)',
  manage_discounts: 'Discounts (edit)',
  view_blog: 'Blog (view)',
  manage_blog: 'Blog (edit)',
  manage_settings: 'Settings',
  manage_staff: 'Staff management',
};

export function StaffManager() {
  const { me } = useAdminMe();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [actionPending, setActionPending] = useState<string | null>(null);

  // Invite form
  const [email, setEmail] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('SUPPORT');

  async function load() {
    try {
      const res = await adminApi.get<ListResponse>('/api/admin/staff');
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.get<ListResponse>('/api/admin/staff');
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email.trim()) return;
    startTransition(async () => {
      try {
        await adminApi.post('/api/admin/staff', {
          email: email.trim(),
          staffRole,
        });
        setSuccess(`${email.trim()} added as ${data?.roles[staffRole].label ?? staffRole}.`);
        setEmail('');
        await load();
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Could not add staff member');
      }
    });
  }

  function changeRole(member: StaffMember, nextRole: StaffRole) {
    if (member.staffRole === nextRole) return;
    setError(null);
    setSuccess(null);
    setActionPending(member.id);
    startTransition(async () => {
      try {
        await adminApi.patch(`/api/admin/staff/${member.id}`, { staffRole: nextRole });
        await load();
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Could not change role');
      } finally {
        setActionPending(null);
      }
    });
  }

  function revoke(member: StaffMember) {
    if (
      !confirm(
        `Revoke admin access for ${member.email}? They'll keep their customer account but lose all backend access.`,
      )
    )
      return;
    setError(null);
    setSuccess(null);
    setActionPending(member.id);
    startTransition(async () => {
      try {
        await adminApi.del(`/api/admin/staff/${member.id}`);
        await load();
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Could not revoke access');
      } finally {
        setActionPending(null);
      }
    });
  }

  function promoteToAdmin(member: StaffMember) {
    if (
      !confirm(
        `Promote ${member.email} to full Admin (Owner level)? Admins can edit other staff, settings, and have unrestricted access. This cannot be undone from this UI.`,
      )
    )
      return;
    setError(null);
    setSuccess(null);
    setActionPending(member.id);
    startTransition(async () => {
      try {
        await adminApi.post(`/api/admin/staff/${member.id}/promote-admin`);
        await load();
      } catch (e) {
        const err = e as { payload?: { message?: string }; message?: string };
        setError(err.payload?.message ?? err.message ?? 'Could not promote to admin');
      } finally {
        setActionPending(null);
      }
    });
  }

  if (!data) {
    if (error) {
      return (
        <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Could not load staff: {error}</p>
          <p className="text-xs">
            If you just added the staff feature, make sure the database migration has been applied:
          </p>
          <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-xs">
            pnpm --filter @vivasvana/db migrate
          </pre>
        </div>
      );
    }
    return <p className="text-sm text-muted-foreground">Loading staff…</p>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-leaf-300 bg-leaf-50 p-3 text-sm text-leaf-800">
          {success}
        </p>
      )}

      {/* === Invite form =============================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Add staff member
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            The person must already have a customer account (they need to{' '}
            <span className="font-medium">sign up at /admin/login</span> first using the same email).
            We&rsquo;ll find them by email and grant the selected role.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[2fr_1.5fr_auto]">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@company.com"
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Role</span>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {data.roles[r].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? 'Adding…' : 'Add staff'}
              </Button>
            </div>
          </form>

          <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium">{data.roles[staffRole].label}</p>
            <p className="mt-1 text-muted-foreground">{data.roles[staffRole].summary}</p>
          </div>
        </CardContent>
      </Card>

      {/* === Staff list ================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current team ({data.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Permissions</th>
                  <th className="px-4 py-3 font-medium">Activity</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((member) => {
                  const isSelf = me?.id === member.id;
                  const isAdmin = member.role === 'ADMIN';
                  return (
                    <tr key={member.id} className="border-b last:border-b-0 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {member.name ?? '—'}
                          {isSelf && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                              you
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <Badge variant="success" className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Owner / Admin
                          </Badge>
                        ) : isSelf ? (
                          <Badge variant="outline">{member.roleLabel}</Badge>
                        ) : (
                          <select
                            value={member.staffRole ?? ''}
                            onChange={(e) => changeRole(member, e.target.value as StaffRole)}
                            disabled={actionPending === member.id}
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                          >
                            {!member.staffRole && <option value="">— select —</option>}
                            {ROLE_ORDER.map((r) => (
                              <option key={r} value={r}>
                                {data.roles[r].label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {member.permissions.map((p) => (
                            <span
                              key={p}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {PERMISSION_LABELS[p]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>
                          Last seen{' '}
                          {member.lastSeenAt
                            ? new Date(member.lastSeenAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })
                            : '—'}
                        </div>
                        {member.invitedAt && (
                          <div>
                            Added{' '}
                            {new Date(member.invitedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                        {member.invitedBy && (
                          <div>by {member.invitedBy.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isSelf && !isAdmin && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionPending === member.id}
                              onClick={() => promoteToAdmin(member)}
                            >
                              Make Admin
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={actionPending === member.id}
                              onClick={() => revoke(member)}
                            >
                              Revoke
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* === Role reference =========================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles &amp; what they can do</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="rounded-md border p-3">
              <p className="font-medium">{data.roles[r].label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.roles[r].summary}</p>
            </div>
          ))}
          <div className="rounded-md border border-leaf-300 bg-leaf-50/50 p-3">
            <p className="flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              Owner / Admin
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Full access including settings and staff management. Cannot be created from this UI —
              promote an existing staff member.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
