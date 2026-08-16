/**
 * Next.js API Route: POST /api/explain/policy
 *
 * Acts as a transparent proxy to the Python AI agent running on
 * AI_AGENT_URL (default: http://localhost:8094).
 *
 * The frontend fetches this relative URL so it doesn't need to know
 * which port the Python service is on, and CORS is handled automatically.
 */

export const runtime = "nodejs";

const AI_AGENT_URL =
  process.env.AI_AGENT_URL ||
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  "http://127.0.0.1:8094";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const upstreamRes = await fetch(`${AI_AGENT_URL}/api/explain/policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await upstreamRes.text();
    return new Response(text, {
      status: upstreamRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ detail: `Policy explainer proxy error: ${msg}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
