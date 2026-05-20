import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, GraduationCap, Landmark, Route, Globe, Loader2 } from "lucide-react";

interface Feature {
  type: string;
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
  properties: {
    osm_id: number;
    name: string | null;
    amenity: string | null;
    building: string | null;
    operator: string | null;
    [key: string]: unknown;
  };
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

interface SearchPanelProps {
  features: Feature[];
  onSelect: (feature: Feature) => void;
  onSelectCoords?: (lat: number, lng: number, label: string) => void;
  onClose: () => void;
}

function getCenter(geometry: Feature["geometry"]): [number, number] | null {
  if (geometry.type === "Point") { const c = geometry.coordinates as number[]; return [c[1], c[0]]; }
  if (geometry.type === "LineString") { const coords = geometry.coordinates as number[][]; const mid = coords[Math.floor(coords.length / 2)]; return [mid[1], mid[0]]; }
  if (geometry.type === "Polygon") { const ring = (geometry.coordinates as number[][][])[0]; const lats = ring.map((c) => c[1]); const lngs = ring.map((c) => c[0]); return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2]; }
  return null;
}

function getIcon(feature: Feature) {
  const a = feature.properties.amenity;
  if (a === "school") return <GraduationCap className="w-4 h-4 text-blue-500" />;
  if (a === "university") return <Landmark className="w-4 h-4 text-purple-500" />;
  if (feature.geometry.type === "LineString") return <Route className="w-4 h-4 text-orange-500" />;
  return <MapPin className="w-4 h-4 text-emerald-600" />;
}

function getLabel(feature: Feature) {
  const a = feature.properties.amenity;
  if (a === "school") return "Sekolah";
  if (a === "university") return "Universitas";
  if (feature.geometry.type === "LineString") return "Jalan";
  if (feature.geometry.type === "Polygon") return "Area";
  return "Lokasi";
}

export default function SearchPanel({ features, onSelect, onSelectCoords, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [nominatimLoading, setNominatimLoading] = useState(false);
  const [tab, setTab] = useState<"local" | "address">("local");
  const inputRef = useRef<HTMLInputElement>(null);
  const nominatimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const namedFeatures = useMemo(() => features.filter((f) => f.properties.name), [features]);

  const localResults = useMemo(() => {
    if (!query.trim()) return namedFeatures.slice(0, 8);
    const q = query.toLowerCase();
    return namedFeatures.filter((f) =>
      f.properties.name?.toLowerCase().includes(q) ||
      f.properties.amenity?.toLowerCase().includes(q) ||
      f.properties.operator?.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [query, namedFeatures]);

  const searchNominatim = useCallback((q: string) => {
    if (!q.trim()) { setNominatimResults([]); return; }
    if (nominatimTimerRef.current) clearTimeout(nominatimTimerRef.current);
    nominatimTimerRef.current = setTimeout(async () => {
      setNominatimLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + " Ngawi")}&format=json&limit=6&countrycodes=id&accept-language=id`;
        const res = await fetch(url, { headers: { "Accept-Language": "id" } });
        const data: NominatimResult[] = await res.json();
        setNominatimResults(data);
      } catch {
        setNominatimResults([]);
      } finally {
        setNominatimLoading(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (tab === "address") searchNominatim(query);
  }, [query, tab, searchNominatim]);

  const handleNominatimSelect = (r: NominatimResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    const shortName = r.display_name.split(",")[0];
    if (onSelectCoords) { onSelectCoords(lat, lng, shortName); onClose(); }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[380px] max-w-[calc(100vw-32px)]" data-testid="search-panel">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "local" ? "Cari nama lokasi..." : "Cari alamat / desa / kecamatan..."}
            className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
            data-testid="input-search"
          />
          <button onClick={onClose} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0" data-testid="button-search-close">
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["local", "address"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === t ? "text-emerald-700 border-b-2 border-emerald-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              {t === "local" ? "📍 Data Lokal" : "🌐 Cari Alamat (OSM)"}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {tab === "local" ? (
            localResults.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Tidak ditemukan untuk "{query}"</div>
            ) : (
              <div className="py-1">
                {!query && <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Lokasi Populer</div>}
                {localResults.map((feature, i) => {
                  const center = getCenter(feature.geometry);
                  if (!center) return null;
                  return (
                    <button
                      key={feature.properties.osm_id ?? i}
                      onClick={() => { onSelect(feature); onClose(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      data-testid={`result-feature-${i}`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">{getIcon(feature)}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{feature.properties.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{getLabel(feature)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="py-1">
              {nominatimLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Mencari alamat...
                </div>
              )}
              {!nominatimLoading && nominatimResults.length === 0 && query && (
                <div className="py-8 text-center text-sm text-gray-400">Tidak ditemukan untuk "{query}"</div>
              )}
              {!nominatimLoading && !query && (
                <div className="py-6 text-center text-sm text-gray-400 px-4">Ketik nama desa, kecamatan, atau alamat untuk mencari</div>
              )}
              {!nominatimLoading && nominatimResults.map((r, i) => (
                <button
                  key={r.place_id}
                  onClick={() => handleNominatimSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  data-testid={`result-nominatim-${i}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.display_name.split(",")[0]}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{r.display_name.split(",").slice(1, 3).join(",")} · {r.type}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "address" && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-[10px] text-gray-400 text-center">Pencarian alamat menggunakan Nominatim OpenStreetMap</p>
          </div>
        )}
      </div>
    </div>
  );
}
