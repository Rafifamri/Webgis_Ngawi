import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, MapPin, GraduationCap, Landmark, Route } from "lucide-react";

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

interface SearchPanelProps {
  features: Feature[];
  onSelect: (feature: Feature) => void;
  onClose: () => void;
}

function getCenter(geometry: Feature["geometry"]): [number, number] | null {
  if (geometry.type === "Point") {
    const c = geometry.coordinates as number[];
    return [c[1], c[0]];
  }
  if (geometry.type === "LineString") {
    const coords = geometry.coordinates as number[][];
    const mid = coords[Math.floor(coords.length / 2)];
    return [mid[1], mid[0]];
  }
  if (geometry.type === "Polygon") {
    const ring = (geometry.coordinates as number[][][])[0];
    const lats = ring.map((c) => c[1]);
    const lngs = ring.map((c) => c[0]);
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }
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

export default function SearchPanel({ features, onSelect, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const namedFeatures = useMemo(
    () => features.filter((f) => f.properties.name),
    [features]
  );

  const results = useMemo(() => {
    if (!query.trim()) return namedFeatures.slice(0, 8);
    const q = query.toLowerCase();
    return namedFeatures
      .filter(
        (f) =>
          f.properties.name?.toLowerCase().includes(q) ||
          f.properties.amenity?.toLowerCase().includes(q) ||
          f.properties.operator?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, namedFeatures]);

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[340px] max-w-[calc(100vw-32px)]"
      data-testid="search-panel"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari lokasi di Ngawi..."
            className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
            data-testid="input-search"
          />
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
            data-testid="button-search-close"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              Tidak ditemukan hasil untuk "{query}"
            </div>
          ) : (
            <div className="py-1">
              {!query && (
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Lokasi Populer
                </div>
              )}
              {results.map((feature, i) => {
                const center = getCenter(feature.geometry);
                if (!center) return null;
                return (
                  <button
                    key={feature.properties.osm_id ?? i}
                    onClick={() => { onSelect(feature); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    data-testid={`result-feature-${i}`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                      {getIcon(feature)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {feature.properties.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{getLabel(feature)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
