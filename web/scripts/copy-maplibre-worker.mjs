// MapLibre GL v6 loads its web worker from a separate file next to its own
// module. Bundlers don't copy it, so serve it from /public instead
// (see setWorkerUrl in src/components/QuoteMap.tsx).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.css"));
mkdirSync("public", { recursive: true });
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.mjs"));
