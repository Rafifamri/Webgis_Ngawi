import { X, MapPin, GraduationCap, Landmark, Route, Building2, Navigation } from "lucide-react";

interface Feature {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: {
    osm_id: number;
    name: string | null;
    amenity: string | null;
    building: string | null;
    operator: string | null;
    public_transport: string | null;
    capacity: number | null;
    isced_level: string | null;
    [key: string]: unknown;
  };
}

interface InfoPanelProps {
  feature: Feature;
  latlng: { lat: number; lng: number };
  onClose: () => void;
}

const amenityLabels: Record<string, { label: string; color: string }> = {
  school: { label: "Sekolah", color: "bg-blue-100 text-blue-700" },
  university: { label: "Universitas/Perguruan Tinggi", color: "bg-purple-100 text-purple-700" },
};

const geometryLabels: Record<string, string> = {
  Point: "Titik Lokasi",
  LineString: "Jalan/Rute",
  Polygon: "Area/Kawasan",
};

function getMainIcon(feature: Feature) {
  const a = feature.properties.amenity;
  if (a === "school") return <GraduationCap className="w-5 h-5 text-blue-600" />;
  if (a === "university") return <Landmark className="w-5 h-5 text-purple-600" />;
  if (feature.geometry.type === "LineString") return <Route className="w-5 h-5 text-orange-600" />;
  if (feature.geometry.type === "Polygon") return <Building2 className="w-5 h-5 text-teal-600" />;
  return <MapPin className="w-5 h-5 text-emerald-600" />;
}

function getBg(feature: Feature) {
  const a = feature.properties.amenity;
  if (a === "school") return "bg-blue-50 border-blue-100";
  if (a === "university") return "bg-purple-50 border-purple-100";
  if (feature.geometry.type === "LineString") return "bg-orange-50 border-orange-100";
  if (feature.geometry.type === "Polygon") return "bg-teal-50 border-teal-100";
  return "bg-emerald-50 border-emerald-100";
}

export default function InfoPanel({ feature, latlng, onClose }: InfoPanelProps) {
  const p = feature.properties;
  const amenityInfo = p.amenity ? amenityLabels[p.amenity] : null;

  const rows: { label: string; value: string }[] = [];
  if (p.name) rows.push({ label: "Nama", value: p.name });
  if (p.amenity) rows.push({ label: "Tipe Fasilitas", value: amenityInfo?.label || p.amenity });
  if (p.operator) rows.push({ label: "Pengelola", value: p.operator });
  if (p.building) rows.push({ label: "Bangunan", value: p.building === "yes" ? "Ya" : p.building });
  if (p.capacity) rows.push({ label: "Kapasitas", value: String(p.capacity) });
  if (p.isced_level) rows.push({ label: "Jenjang ISCED", value: p.isced_level });
  if (p.public_transport) rows.push({ label: "Transportasi Umum", value: p.public_transport });
  rows.push({ label: "Koordinat", value: `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}` });
  rows.push({ label: "Tipe Geometri", value: geometryLabels[feature.geometry.type] || feature.geometry.type });
  if (p.osm_id) rows.push({ label: "OSM ID", value: String(p.osm_id) });

  return (
    <div
      className="absolute bottom-6 left-4 z-[1000] w-[300px] max-w-[calc(100vw-32px)] max-h-[60vh] flex flex-col"
      data-testid="info-panel"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        <div className={`flex items-start gap-3 p-4 border-b ${getBg(feature)}`}>
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
            {getMainIcon(feature)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">
              {p.name || "Fitur Tanpa Nama"}
            </h3>
            {amenityInfo && (
              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${amenityInfo.color}`}>
                {amenityInfo.label}
              </span>
            )}
            {!amenityInfo && (
              <span className="inline-block mt-1 text-xs text-gray-500">
                {geometryLabels[feature.geometry.type]}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors shadow-sm shrink-0"
            data-testid="button-info-close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-2">
          <div className="space-y-0.5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex justify-between gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs text-gray-500 shrink-0">{row.label}</span>
                <span className="text-xs font-medium text-gray-800 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-gray-100">
          <a
            href={`https://www.google.com/maps?q=${latlng.lat},${latlng.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            data-testid="link-open-maps"
          >
            <Navigation className="w-3.5 h-3.5" />
            Buka di Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
