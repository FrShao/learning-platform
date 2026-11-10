export default function HomePage() {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Learning Platform</h1>
      <p>
        Author and learner UI stub. API base: <code>{apiUrl}</code>
      </p>
      <p>Phase 1 screens and authoring flows land in follow-up work.</p>
    </main>
  );
}
