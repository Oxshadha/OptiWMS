/**
 * Task notes double as a machine-readable field: the putaway flow writes and reads
 * markers such as PUTAWAY_HU_QTY, PUTAWAY_PROGRESS and PUTAWAY_SKIP_REASON there, and
 * older rows also carry an `orderId=<uuid>; hu=3/3;` prefix.
 *
 * For display, the markers that carry meaning for a reader are translated into plain
 * words and the pure bookkeeping ones are dropped. This is display-only — never write
 * the formatted text back, or the flow loses the markers it parses.
 */

/** Bookkeeping only: nothing here tells a reader anything they cannot see elsewhere. */
const NOISE_MARKERS = [
  /PUTAWAY_HU_QTY=\d+/gi,
  /orderId=[0-9a-f-]{36}/gi,
  /\bhu=\d+\/\d+/gi,
];

const SKIP_REASON = /PUTAWAY_SKIP_REASON=([^\n\r;]*)(;workerId=[^\n\r;]*)?(;at=[^\n\r;]*)?/gi;
const PROGRESS = /PUTAWAY_PROGRESS=(\d+)\/(\d+)/gi;

function decodeReason(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function formatTaskNotes(notes?: string | null): string {
  if (!notes) {
    return "";
  }

  let readable = notes
    .replace(SKIP_REASON, (_match, reason: string) =>
      reason ? `Skipped: ${decodeReason(reason)}` : "Skipped"
    )
    .replace(PROGRESS, (_match, done: string, total: string) => `Progress: ${done} of ${total}`);

  NOISE_MARKERS.forEach((marker) => {
    readable = readable.replace(marker, "");
  });

  return readable
    .split(/\r?\n/)
    .map((line) =>
      line
        // Tidy the separators left behind by removed markers.
        .replace(/\s*;\s*/g, "; ")
        .replace(/^[\s;.]+/, "")
        .replace(/[\s;]+$/, "")
        .replace(/\s{2,}/g, " ")
    )
    .filter((line) => line.length > 0)
    .join("\n");
}
