'use client';

import Link from 'next/link';

import { EmptyState } from '@/components/states/async-state';
import type { CourseDto, PathDto } from '@/lib/api/types';

export function CatalogLists({
  courses,
  paths,
  emptyTitle,
  emptyDescription,
}: {
  courses: CourseDto[];
  paths: PathDto[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (courses.length === 0 && paths.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? 'Nothing available yet'}
        description={
          emptyDescription ?? 'Published lessons and paths you can take will show up here.'
        }
      />
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h2>Paths</h2>
        {paths.length === 0 ? (
          <p className="muted">No paths in this list.</p>
        ) : (
          <div className="card-list">
            {paths.map((p) => (
              <Link key={p.id} href={`/app/learn/paths/${p.id}`} className="list-row">
                <div>
                  <strong>{p.title}</strong>
                  <div className="meta-row">
                    <span>/{p.slug}</span>
                    <span className="badge">Path</span>
                    {p.orgId ? (
                      <span className="badge">Org</span>
                    ) : (
                      <span className="badge">Public</span>
                    )}
                  </div>
                  {p.description ? <p className="muted">{p.description}</p> : null}
                </div>
                <span className="muted">Open →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Lessons</h2>
        {courses.length === 0 ? (
          <p className="muted">No lessons in this list.</p>
        ) : (
          <div className="card-list">
            {courses.map((c) => (
              <Link key={c.id} href={`/app/learn/courses/${c.id}`} className="list-row">
                <div>
                  <strong>{c.title}</strong>
                  <div className="meta-row">
                    <span>/{c.slug}</span>
                    <span className="badge ok">Published</span>
                    {c.orgId ? (
                      <span className="badge">Org</span>
                    ) : (
                      <span className="badge">Public</span>
                    )}
                  </div>
                  {c.description ? <p className="muted">{c.description}</p> : null}
                </div>
                <span className="muted">Open →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
