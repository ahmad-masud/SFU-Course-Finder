const BASE = "http://www.sfu.ca/bin/wcm/course-outlines";

export type FetchResult<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  url: string;
};

/**
 * Build the SFU Course Outlines URL. Most endpoints require a '?' followed by path segments.
 * For years list, there are no parameters at all.
 */
export function buildSfuUrl(segments?: Array<string | number>): string {
  if (!segments || segments.length === 0) return BASE;
  const parts = segments
    .filter((s) => s !== undefined && s !== null && `${s}`.length > 0)
    .map((s) => `${s}`.toLowerCase());
  return `${BASE}?${parts.join("/")}`;
}

export async function fetchSfu<T = unknown>(segments?: Array<string | number>, revalidateSeconds = 3600): Promise<FetchResult<T>> {
  const url = buildSfuUrl(segments);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      // Cache on the server for a bit; these lists don't change constantly
      next: { revalidate: revalidateSeconds },
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = `Request failed with ${res.status}`;
      try {
        const body = await res.text();
        if (body) message += `: ${body}`;
      } catch {}
      return { ok: false, status: res.status, error: message, url };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: 200, data, url };
  } catch (e: unknown) {
    const aborted = typeof e === "object" && e !== null && "name" in e && (e as { name?: string }).name === "AbortError";
    const message = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message) : "Network error";
    return { ok: false, status: aborted ? 504 : 500, error: aborted ? "Upstream timeout" : message, url };
  }
  finally {
    clearTimeout(timeout);
  }
}

// Helper to normalize various list payloads into label/value shape for UI selects
export type Option = { label: string; value: string };

export function normalizeToOptions(input: unknown): Option[] {
  if (!Array.isArray(input)) return [];
  // Common shapes: ["2015", "2016"], [{text, value}], [{term:"fall"}], numbers, etc.
  return (
    input
      .map((item: unknown) => {
        if (item == null) return null;
        if (typeof item === "string" || typeof item === "number") {
          const v = String(item);
          return { label: titleCase(v), value: v.toLowerCase() };
        }
        if (typeof item === "object") {
          const o = item as Record<string, unknown>;
          const value =
            (o.value as unknown) ??
            (o.code as unknown) ??
            (o.department as unknown) ??
            (o.dept as unknown) ??
            (o.term as unknown) ??
            (o.year as unknown) ??
            (o.text as unknown) ??
            (o.name as unknown) ??
            (o.number as unknown) ??
            (o.id as unknown);
          const label = (o.text as unknown) ?? (o.title as unknown) ?? (o.name as unknown) ?? (o.label as unknown) ?? value;
          if (value == null) return null;
          return { label: String(label ?? value), value: String(value).toLowerCase() };
        }
        return null;
      })
      .filter(Boolean) as Option[]
  );
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
