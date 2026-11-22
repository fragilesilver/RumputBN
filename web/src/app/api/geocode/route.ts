import { NextResponse, type NextRequest } from "next/server";

/**
 * Address search, restricted to Brunei, proxied through our server so we can
 * send an identifying User-Agent as Nominatim's usage policy requires
 * (https://operations.osmfoundation.org/policies/nominatim/). Fine for an MVP;
 * switch to a paid geocoder before real traffic.
 */
export type GeocodeResult = { label: string; lng: number; lat: number };

const USER_AGENT = `RumputBN/0.1${
  process.env.NOMINATIM_CONTACT ? ` (${process.env.NOMINATIM_CONTACT})` : ""
}`;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) {
    return NextResponse.json({ results: [] satisfies GeocodeResult[] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "bn",
    limit: "5",
    "accept-language": "en,ms",
  }).toString();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = (await res.json()) as { display_name: string; lon: string; lat: string }[];
    const results: GeocodeResult[] = data.map((d) => ({
      label: d.display_name,
      lng: Number(d.lon),
      lat: Number(d.lat),
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "Search is unavailable right now." }, { status: 502 });
  }
}
