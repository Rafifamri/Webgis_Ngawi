import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Navigation, Search, X, MapPin, ArrowDown, Loader2,
  RotateCcw, Car, Clock, Route, Globe, GraduationCap, Landmark,
} from "lucide-react";

interface GeoFeature {
  type: string;
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
  properties: { osm_id: number; name: string | null; amenity: string | null; [key: string]: unknown };
}

export interface RoutingLocation {
  lat: number;
  lng: number;
  name: string;
}

interface RoutingPanelProps {
  features: GeoFeature[];
  routeInfo: { distance: number; duration: number } | null;
  loading: boolean;
  error: string | null;
  from: RoutingLocation | null;
  to: RoutingLocation | null;
  onFromChange: (loc: RoutingLocation | null) => void;
  onToChange: (loc: RoutingLocation | null) => void;
  onCalculate: () => void;
  onClear: () => void;
  onClose: () => void;
}

interface Suggestion {
  lat: number;
  lng: number;
  name: string;
  subtitle: string;
  source: "local" | "nominatim";
}

function getFeatureCenter(geometry: GeoFeature["geometry"]): [number, number] | null {
  if (geometry.type === "Point") { const c = geometry.coordinates as number[]; return [c[1], c[0]]; }
  if (geometry.type === "LineString") { const coords = geometry.coordinates as number[][]; const mid = coords[Math.floor(coords.length / 2)]; return [mid[1], mid[0]]; }
  if (geometry.type === "Polygon") { const ring = (geometry.coordinates as number[][][])[0]; const lats = ring.map((c) => c[1]); const lngs = ring.map((c) => c[0]); return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2]; }
  return null;
}

function getFeatureIcon(f: GeoFeature) {
  if (f.properties.amenity === "school") return <GraduationCap className="w-3.5 h-3.5 text-blue-500" />;
  if (f.properties.amenity === "university") return <Landmark className="w-3.5 h-3.5 text-purple-500" />;
  return <MapPin className="w-3.5 h-3.5 text-emerald-600" />;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs} jam ${mins} menit`;
  if (mins === 0) return "< 1 menit";
  return `${mins} menit`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Reusable location search input
function LocationInput({
  placeholder, value, onChange, features, color,
}: {
  placeholder: string;
  value: RoutingLocation | null;
  onChange: (loc: RoutingLocation | null) => void;
  features: GeoFeature[];
  color: "emerald" | "blue";
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [nominatimResults, setNominatimResults] = useState<Suggestion[]>([]);
  const [nominatimLoading, setNominatimLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value?.name ?? ""); }, [value]);

  const namedFeatures = useMemo(() => features.filter((f) => f.properties.name), [features]);

  const localSuggestions = useMemo((): Suggestion[] => {
    if (!query.trim()) return namedFeatures.slice(0, 6).map((f) => {
      const center = getFeatureCenter(f.geometry);
      return center ? { lat: center[0], lng: center[1], name: f.properties.name!, subtitle: f.properties.amenity ?? "Lokasi", source: "local" } : null;
    }).filter(Boolean) as Suggestion[];
    const q = query.toLowerCase();
    return namedFeatures.filter((f) =>
      f.properties.name?.toLowerCase().includes(q) ||
      f.properties.amenity?.toLowerCase().includes(q)
    ).slice(0, 8).map((f) => {
      const center = getFeatureCenter(f.geometry);
      return center ? { lat: center[0], lng: center[1], name: f.properties.name!, subtitle: f.properties.amenity ?? "Lokasi", source: "local" as const } : null;
    }).filter(Boolean) as Suggestion[];
  }, [query, namedFeatures]);

  const searchNominatim = useCallback((q: string) => {
    if (!q.trim()) { setNominatimResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setNominatimLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + " Ngawi Indonesia")}&format=json&limit=5&countrycodes=id&accept-language=id`);
        const data: Array<{ place_id: number; display_name: string; lat: string; lon: string; type: string }> = await res.json();
        setNominatimResults(data.map((r) => ({
          lat: parseFloat(r.lat), lng: parseFloat(r.lon),
          name: r.display_name.split(",")[0],
          subtitle: r.display_name.split(",").slice(1, 3).join(",").trim(),
          source: "nominatim" as const,
        })));
      } catch { setNominatimResults([]); }
      finally { setNominatimLoading(false); }
    }, 600);
  }, []);

  useEffect(() => { if (open && query.length > 2) searchNominatim(query); }, [query, open, searchNominatim]);

  const allSuggestions: Suggestion[] = [...localSuggestions, ...nominatimResults];

  const handleSelect = (s: Suggestion) => {
    setQuery(s.name);
    setOpen(false);
    onChange({ lat: s.lat, lng: s.lng, name: s.name });
  };

  const handleClear = () => { setQuery(""); onChange(null); setNominatimResults([]); inputRef.current?.focus(); };

  const ringColor = color === "emerald" ? "focus:ring-emerald-400" : "focus:ring-blue-400";
  const dotColor = color === "emerald" ? "bg-emerald-500" : "bg-blue-500";

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 rounded-xl border bg-gray-50 px-3 py-2 transition-all ${open ? "border-gray-300 bg-white ring-2 " + ringColor : "border-gray-200 hover:border-gray-300"}`}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400 min-w-0"
        />
        {nominatimLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" />}
        {query && !nominatimLoading && (
          <button onClick={handleClear} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-52 overflow-y-auto">
          {allSuggestions.length === 0 && !nominatimLoading && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              {query ? "Tidak ditemukan hasil" : "Mulai ketik untuk mencari..."}
            </div>
          )}
          {allSuggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                {s.source === "nominatim" ? <Globe className="w-3.5 h-3.5 text-blue-500" /> : <MapPin className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{s.name}</div>
                <div className="text-[11px] text-gray-400 truncate">{s.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {open && <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />}
    </div>
  );
}

export default function RoutingPanel({
  features, routeInfo, loading, error, from, to,
  onFromChange, onToChange, onCalculate, onClear, onClose,
}: RoutingPanelProps) {
  const canCalculate = from && to && !loading;

  const swapLocations = () => {
    const tmp = from;
    onFromChange(to);
    onToChange(tmp);
  };

  return (
    <div
      className="absolute top-4 right-4 z-[1001] w-80"
      data-testid="routing-panel"
    >
      <div className="bg-white/97 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-700 to-indigo-700">
          <Navigation className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white flex-1">Petunjuk Arah</span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            data-testid="button-routing-close"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Location inputs */}
        <div className="p-3 space-y-2">
          <div className="relative">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1">Dari</div>
            <LocationInput
              placeholder="Pilih titik awal..."
              value={from}
              onChange={onFromChange}
              features={features}
              color="emerald"
            />
          </div>

          {/* Swap button */}
          <div className="flex justify-center">
            <button
              onClick={swapLocations}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors text-gray-400"
              title="Tukar asal dan tujuan"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 px-1">Ke</div>
            <LocationInput
              placeholder="Pilih tujuan..."
              value={to}
              onChange={onToChange}
              features={features}
              color="blue"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-3 pb-3 flex gap-2">
          <button
            onClick={onCalculate}
            disabled={!canCalculate}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              canCalculate
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            data-testid="button-calculate-route"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Menghitung...</>
            ) : (
              <><Route className="w-4 h-4" /> Tampilkan Rute</>
            )}
          </button>
          {(from || to || routeInfo) && (
            <button
              onClick={onClear}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors text-gray-500"
              title="Hapus rute"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Route info */}
        {routeInfo && (
          <div className="mx-3 mb-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-blue-100 flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-600 rounded-lg flex items-center justify-center">
                <Navigation className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-bold text-blue-900">Rute Ditemukan</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-blue-100">
              <div className="px-3 py-2.5 flex items-center gap-2">
                <Route className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Jarak</div>
                  <div className="text-sm font-bold text-gray-900">{formatDistance(routeInfo.distance)}</div>
                </div>
              </div>
              <div className="px-3 py-2.5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Estimasi</div>
                  <div className="text-sm font-bold text-gray-900">{formatDuration(routeInfo.duration)}</div>
                </div>
              </div>
            </div>
            <div className="px-3 py-2 border-t border-blue-100 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] text-gray-500">Rute kendaraan bermotor via OSRM</span>
            </div>
          </div>
        )}

        {/* Tips */}
        {!routeInfo && !loading && !error && (
          <div className="mx-3 mb-3 bg-gray-50 rounded-xl px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Search className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Ketik nama tempat, sekolah, desa, atau kecamatan di Ngawi untuk mencari titik asal dan tujuan.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
