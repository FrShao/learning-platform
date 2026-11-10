/**
 * Post-start smoke harness. Against a running stack, checks API health.
 * Expand with register → course → publish → enroll when Phase 1 lands.
 */

const baseUrl = process.env['BASE_URL'] ?? process.env['API_URL'] ?? 'http://127.0.0.1:3000';

async function main(): Promise<void> {
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;
  console.log(`[smoke] GET ${healthUrl}`);

  try {
    const res = await fetch(healthUrl);
    if (!res.ok) {
      throw new Error(`health returned ${res.status}`);
    }
    const body: unknown = await res.json();
    console.log('[smoke] ok', body);
  } catch (err) {
    console.error('[smoke] failed — is the API running?', err);
    process.exitCode = 1;
  }
}

void main();
