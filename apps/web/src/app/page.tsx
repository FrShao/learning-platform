'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth/auth-context';

export default function LandingPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/app');
    }
  }, [status, router]);

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand-mark">
          Learning<span>Platform</span>
        </Link>
        <div className="cta-row">
          <Link className="btn btn-ghost" href="/login">
            Sign in
          </Link>
          <Link className="btn btn-primary" href="/register">
            Create account
          </Link>
        </div>
      </nav>
      <section className="landing-hero">
        <p className="brand-mark" style={{ fontSize: '1.35rem', margin: 0 }}>
          Learning<span>Platform</span>
        </p>
        <h1>Courses with real version history.</h1>
        <p className="lede">
          Draft on a branch, commit your tree, publish a snapshot learners can trust — then track
          progress section by section.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/register">
            Get started
          </Link>
          <Link className="btn btn-secondary" href="/login">
            Sign in
          </Link>
        </div>
        <div className="hero-visual" aria-hidden>
          <strong>Working tree → commit → publish</strong>
          <p style={{ margin: '0.35rem 0 0', opacity: 0.85 }}>
            Authors edit dirty trees. Learners only see the published commit.
          </p>
        </div>
      </section>
    </div>
  );
}
