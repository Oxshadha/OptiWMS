/**
 * Next.js API Route: POST /api/explain/forecast/stream
 *
 * Acts as a transparent proxy to the Python AI agent running on
 * AI_AGENT_URL (default: http://localhost:8000).
 *
 * The frontend fetches this relative URL so it doesn't need to know
 * which port the Python service is on, and CORS is handled automatically.
 */

export const runtime = "nodejs";

const AI_AGENT_URL =
  process.env.AI_AGENT_URL ||
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const upstreamRes = await fetch(
      `${AI_AGENT_URL}/api/explain/forecast/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // @ts-expect-error – Node fetch duplex required for streaming
        duplex: "half",
      },
    );

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => "");
      return new Response(
        `Upstream AI agent error (${upstreamRes.status}): ${text}`,
        { status: upstreamRes.status },
      );
    }

    // Pipe the streaming response straight through to the browser
    return new Response(upstreamRes.body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      `Forecast explainer proxy error: ${msg}`,
      { status: 502 },
    );
  }
}
