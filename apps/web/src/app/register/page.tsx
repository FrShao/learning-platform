'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth/auth-context';
import { errorMessage } from '@/lib/format';

export default function RegisterPage() {
  const { signUp, status } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/app');
    }
  }, [status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp(name, email, password);
      router.replace('/app');
    } catch (err) {
      setError(errorMessage(err, 'Could not create account'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card form-grid" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <Link href="/" className="brand-mark">
            Learning<span>Platform</span>
          </Link>
          <h1>Create account</h1>
          <p className="lede">Start by creating your user, then pick or create an organization.</p>
        </div>
        <div className="field">
          <Label htmlFor="register-name">Name</Label>
          <Input
            id="register-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
        <p className="muted">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
