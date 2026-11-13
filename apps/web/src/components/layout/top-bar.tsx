'use client';

import { ChevronDown, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/auth-context';
import { roleLabel } from '@/lib/roles';

export function TopBar({
  orgId,
  orgName,
  personal,
}: {
  orgId?: string | undefined;
  orgName?: string | undefined;
  personal?: boolean | undefined;
}) {
  const { user, memberships, signOut } = useAuth();
  const router = useRouter();

  const currentRole = memberships.find((m) => m.orgId === orgId)?.role;
  const showSwitcher = Boolean(orgId) || personal;
  const initials =
    user?.name
      ?.split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?';

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <Link
          href={orgId ? `/app/orgs/${orgId}` : personal ? '/app/me' : '/app'}
          className="brand-mark"
        >
          Learning<span>Platform</span>
        </Link>
        {showSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type="button" className="org-switcher-btn">
                  <span className="org-switcher-label">
                    {personal ? 'Personal library' : (orgName ?? 'Organization')}
                  </span>
                  {!personal && currentRole ? (
                    <Badge variant="secondary" className="role-chip border-0">
                      {roleLabel(currentRole)}
                    </Badge>
                  ) : null}
                  <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
                </button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuItem render={<Link href="/app/me" />}>
                <div className="grid gap-0.5">
                  <strong>Personal library</strong>
                  <span className="text-xs text-muted-foreground">Your courses & paths</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {memberships.map((m) => (
                <DropdownMenuItem key={m.orgId} render={<Link href={`/app/orgs/${m.orgId}`} />}>
                  <div className="grid gap-0.5">
                    <strong>{m.org.name}</strong>
                    <span className="text-xs text-muted-foreground">{roleLabel(m.role)}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/app/orgs/new" />}>
                Create organization
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/app" />}>All organizations</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="top-bar-right">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type="button" className="user-menu-btn">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[0.65rem]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="org-switcher-label">{user.name}</span>
                  <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuLabel className="font-normal">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  signOut();
                  router.push('/login');
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" render={<Link href="/login" />}>
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
