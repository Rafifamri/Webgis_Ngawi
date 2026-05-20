import { X, GraduationCap, ChevronRight, BookOpen, Users, Building2 } from "lucide-react";

export interface SchoolFeature {
  type: string;
  geometry: {
    type: "Point" | "LineString" | "Polygon";
    coordinates: number[] | number[][] | number[][][];
  };
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

interface SchoolListPanelProps {
  features: SchoolFeature[];
  onSelect: (feature: SchoolFeature) => void;
  onClose: () => void;
}

export type SchoolLevel = "SD" | "SMP" | "SMA" | "SMK" | "AKPER" | "UNIVERSITAS" | "LAINNYA";

export function getSchoolLevel(name: string | null, amenity: string | null): SchoolLevel {
  if (!name) return amenity === "university" ? "UNIVERSITAS" : "LAINNYA";
  const n = name.toUpperCase();
  if (amenity === "university") return "UNIVERSITAS";
  if (n.includes("AKPER") || n.includes("AKADEMI")) return "AKPER";
  if (n.includes("SMK")) return "SMK";
  if (n.includes("SMA") || n.includes("MA ") || n.includes("MA N")) return "SMA";
  if (n.includes("SMP") || n.includes("SMPN") || n.includes("MTS")) return "SMP";
  if (n.includes("SD") || n.includes("SDN") || n.includes("SDK") || n.includes("MI ") || n.includes("MI N")) return "SD";
  return "LAINNYA";
}

export const SCHOOL_LEVEL_CONFIG: Record<SchoolLevel, {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  border: string;
  markerColor: string;
  emoji: string;
  description: string;
}> = {
  SD: {
    label: "Sekolah Dasar",
    shortLabel: "SD",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    markerColor: "#0ea5e9",
    emoji: "📚",
    description: "Tingkat dasar",
  },
  SMP: {
    label: "Sekolah Menengah Pertama",
    shortLabel: "SMP",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    markerColor: "#7c3aed",
    emoji: "📖",
    description: "Tingkat menengah pertama",
  },
  SMA: {
    label: "Sekolah Menengah Atas",
    shortLabel: "SMA",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    markerColor: "#d97706",
    emoji: "🎓",
    description: "Tingkat menengah atas",
  },
  SMK: {
    label: "Sekolah Menengah Kejuruan",
    shortLabel: "SMK",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    markerColor: "#ea580c",
    emoji: "🔧",
    description: "Kejuruan / vokasi",
  },
  AKPER: {
    label: "Akademi Keperawatan",
    shortLabel: "AKPER",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    markerColor: "#e11d48",
    emoji: "🏥",
    description: "Diploma keperawatan",
  },
  UNIVERSITAS: {
    label: "Universitas",
    shortLabel: "UNIV",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    markerColor: "#7c3aed",
    emoji: "🏛️",
    description: "Perguruan tinggi",
  },
  LAINNYA: {
    label: "Lainnya",
    shortLabel: "—",
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
    markerColor: "#6b7280",
    emoji: "🏫",
    description: "Lainnya",
  },
};

const LEVEL_ORDER: SchoolLevel[] = ["SD", "SMP", "SMA", "SMK", "AKPER", "UNIVERSITAS", "LAINNYA"];

export default function SchoolListPanel({ features, onSelect, onClose }: SchoolListPanelProps) {
  const schools = features.filter(
    (f) => f.properties.amenity === "school" || f.properties.amenity === "university"
  );

  const byLevel: Record<SchoolLevel, SchoolFeature[]> = {
    SD: [], SMP: [], SMA: [], SMK: [], AKPER: [], UNIVERSITAS: [], LAINNYA: [],
  };

  schools.forEach((f) => {
    const level = getSchoolLevel(f.properties.name, f.properties.amenity);
    byLevel[level].push(f);
  });

  const totalNamed = schools.filter((f) => f.properties.name).length;

  return (
    <div
      className="absolute top-4 right-4 z-[1001] w-72 max-h-[calc(100vh-80px)] flex flex-col"
      data-testid="school-list-panel"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Data Sekolah Ngawi</div>
            <div className="text-xs text-emerald-100 mt-0.5">{totalNamed} sekolah ditemukan</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            data-testid="button-school-list-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
          {(["SD", "SMP", "SMA", "SMK"] as SchoolLevel[]).map((level) => {
            const cfg = SCHOOL_LEVEL_CONFIG[level];
            return (
              <div key={level} className="flex flex-col items-center py-2.5 px-1">
                <span className="text-lg leading-none">{cfg.emoji}</span>
                <span className="text-sm font-bold text-gray-800 mt-1">{byLevel[level].length}</span>
                <span className={`text-xs font-semibold mt-0.5 ${cfg.color}`}>{cfg.shortLabel}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {LEVEL_ORDER.filter((l) => byLevel[l].length > 0).map((level) => {
              const cfg = SCHOOL_LEVEL_CONFIG[level];
              return (
                <span
                  key={level}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                >
                  <span className="text-[11px]">{cfg.emoji}</span>
                  {cfg.shortLabel}
                </span>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {LEVEL_ORDER.filter((level) => byLevel[level].length > 0).map((level) => {
            const cfg = SCHOOL_LEVEL_CONFIG[level];
            return (
              <div key={level}>
                <div className={`px-4 py-2 flex items-center gap-2 sticky top-0 ${cfg.bg} border-b ${cfg.border}`}>
                  <span className="text-base">{cfg.emoji}</span>
                  <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {byLevel[level].length}
                  </span>
                </div>
                {byLevel[level].map((feature, i) => (
                  <button
                    key={feature.properties.osm_id ?? i}
                    onClick={() => onSelect(feature)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 text-left"
                    data-testid={`button-school-${level}-${i}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
                      <span className="text-sm">{cfg.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate leading-tight">
                        {feature.properties.name || "Tanpa Nama"}
                      </div>
                      {feature.properties.operator && (
                        <div className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          {feature.properties.operator}
                        </div>
                      )}
                      {!feature.properties.operator && (
                        <div className={`text-xs mt-0.5 ${cfg.color}`}>{cfg.description}</div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Sumber: OpenStreetMap Ngawi</span>
            <Users className="w-3.5 h-3.5 ml-auto" />
            <span>{schools.length} total</span>
          </div>
        </div>
      </div>
    </div>
  );
}
