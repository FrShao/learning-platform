'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { CatalogLists } from '@/components/learner/catalog-lists';
import { ErrorState, LoadingBlock } from '@/components/states/async-state';
import { api } from '@/lib/api/client';
import type { CourseDto, PathDto } from '@/lib/api/types';
import { errorMessage } from '@/lib/format';

export default function ExplorePage() {
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [paths, setPaths] = useState<PathDto[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [enrolledPathIds, setEnrolledPathIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([api.getCatalog(), api.getMyEnrollments()])
      .then(([catalog, enrollments]) => {
        if (cancelled) return;
        setCourses(catalog.courses);
        setPaths(catalog.paths);
        setEnrolledCourseIds(new Set(enrollments.courses.map((r) => r.enrollment.courseId)));
        setEnrolledPathIds(new Set(enrollments.paths.map((r) => r.enrollment.pathId)));
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load catalog'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      const aEnrolled = enrolledCourseIds.has(a.id) ? 0 : 1;
      const bEnrolled = enrolledCourseIds.has(b.id) ? 0 : 1;
      return aEnrolled - bEnrolled || a.title.localeCompare(b.title);
    });
  }, [courses, enrolledCourseIds]);

  const sortedPaths = useMemo(() => {
    return [...paths].sort((a, b) => {
      const aEnrolled = enrolledPathIds.has(a.id) ? 0 : 1;
      const bEnrolled = enrolledPathIds.has(b.id) ? 0 : 1;
      return aEnrolled - bEnrolled || a.title.localeCompare(b.title);
    });
  }, [paths, enrolledPathIds]);

  if (loading) return <LoadingBlock label="Loading catalog…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Explore</h1>
          <p>All publicly available lessons and paths you can take.</p>
        </div>
        <Link className="btn btn-secondary" href="/app">
          Back to home
        </Link>
      </div>
      <CatalogLists
        courses={sortedCourses}
        paths={sortedPaths}
        emptyTitle="Catalog is empty"
        emptyDescription="When authors publish lessons or create paths, they appear here."
      />
    </div>
  );
}
