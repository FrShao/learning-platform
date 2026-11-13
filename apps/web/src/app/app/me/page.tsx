'use client';

import { ArrowRight, BookOpen, Route } from 'lucide-react';
import Link from 'next/link';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/auth-context';

export default function PersonalHomePage() {
  const { user } = useAuth();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Personal library</h1>
          <p>Create courses and paths as {user?.name ?? 'you'} without joining an organization.</p>
        </div>
      </div>
      <div className="card-list">
        <Link href="/app/me/courses">
          <Card className="list-row border-0 ring-1 ring-border transition hover:ring-primary/40">
            <CardHeader className="flex-row items-center justify-between gap-3 p-0">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 size-5 text-primary" aria-hidden />
                <div>
                  <CardTitle>Courses</CardTitle>
                  <CardDescription>
                    Author lessons with working trees, commits, and publish
                  </CardDescription>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
          </Card>
        </Link>
        <Link href="/app/me/paths">
          <Card className="list-row border-0 ring-1 ring-border transition hover:ring-primary/40">
            <CardHeader className="flex-row items-center justify-between gap-3 p-0">
              <div className="flex items-start gap-3">
                <Route className="mt-0.5 size-5 text-primary" aria-hidden />
                <div>
                  <CardTitle>Paths</CardTitle>
                  <CardDescription>
                    Build learning journeys from your published lessons
                  </CardDescription>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
