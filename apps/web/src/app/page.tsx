'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
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
          <Button variant="ghost" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button render={<Link href="/register" />}>Create account</Button>
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
          <Button render={<Link href="/register" />}>
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" render={<Link href="/login" />}>
            Sign in
          </Button>
        </div>
        <div className="hero-visual" aria-hidden>
          <strong className="inline-flex flex-wrap items-center gap-2">
            Working tree
            <ArrowRight className="size-4 opacity-80" />
            commit
            <ArrowRight className="size-4 opacity-80" />
            publish
          </strong>
          <p style={{ margin: '0.35rem 0 0', opacity: 0.85 }}>
            Authors edit dirty trees. Learners only see the published commit.
          </p>
        </div>
      </section>
    </div>
  );
}
