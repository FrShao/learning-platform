'use client';

import Link from 'next/link';

import { useAuth } from '@/lib/auth/auth-context';

export default function PersonalHomePage() {
  const { user } = useAuth();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Personal library</h1>
          <p>
            Create courses and paths as {user?.name ?? 'you'} without joining an organization.
            Management also lives under <Link href="/app/account/lessons">Account → Lessons</Link>.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/app">
          Learner home
        </Link>
      </div>
      <div className="card-list">
        <Link href="/app/me/courses" className="list-row">
          <div>
            <strong>Courses</strong>
            <div className="meta-row">
              <span>Author lessons with working trees, commits, and publish</span>
            </div>
          </div>
          <span className="muted">Open →</span>
        </Link>
        <Link href="/app/me/paths" className="list-row">
          <div>
            <strong>Paths</strong>
            <div className="meta-row">
              <span>Build learning journeys from your published lessons</span>
            </div>
          </div>
          <span className="muted">Open →</span>
        </Link>
      </div>
    </div>
  );
}
