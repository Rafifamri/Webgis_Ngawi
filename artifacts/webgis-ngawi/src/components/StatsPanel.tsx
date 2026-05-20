import { X, BarChart3, AlertTriangle, CheckCircle2, AlertCircle, Info, TrendingUp, Database, Users, Building2, BookOpen } from "lucide-react";
import { getSchoolLevel, SCHOOL_LEVEL_CONFIG, SchoolLevel } from "./SchoolListPanel";

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

interface StatsPanelProps {
  features: Feature[];
  onSelectSchool: (feature: Feature) => void;
  onClose: () => void;
}

type Priority = "kritis" | "rendah" | "sedang" | "baik";

interface SchoolStat {
  feature: Feature;
  name: string;
  level: SchoolLevel;
  score: number;
  maxScore: number;
  pct: number;
  priority: Priority;
  missing: string[];
  present: string[];
  geomType: string;
}

const FIELDS = [
  { key: "name",             label: "Nama",             weight: 2 },
  { key: "operator",         label: "Pengelola",        weight: 2 },
  { key: "capacity",         label: "Kapasitas",        weight: 2 },
  { key: "building",         label: "Data Bangunan",    weight: 1 },
  { key: "isced_level",      label: "Jenjang ISCED",    weight: 1 },
  { key: "public_transport", label: "Akses Transportasi", weight: 1 },
];
const MAX_SCORE = FIELDS.reduce((s, f) => s + f.weight, 0);

function priorityFromPct(pct: number, hasName: boolean): Priority {
  if (!hasName) return "kritis";
  if (pct <= 25) return "rendah";
  if (pct <= 50) return "sedang";
  return "baik";
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; bar: string }> = {
  kritis: {
    label: "Kritis",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    bar: "bg-red-500",
  },
  rendah: {
    label: "Data Minim",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    bar: "bg-orange-400",
  },
  sedang: {
    label: "Parsial",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: <Info className="w-3.5 h-3.5" />,
    bar: "bg-amber-400",
  },
  baik: {
    label: "Cukup",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    bar: "bg-emerald-500",
  },
};

function analyzeSchools(features: Feature[]): SchoolStat[] {
  return features
    .filter((f) => f.properties.amenity === "school" || f.properties.amenity === "university")
    .map((f) => {
      const p = f.properties;
      const level =
        p.amenity === "university" ? "UNIVERSITAS" : getSchoolLevel(p.name, p.amenity);
      let score = 0;
      const missing: string[] = [];
      const present: string[] = [];
      for (const field of FIELDS) {
        const val = p[field.key];
        if (val !== null && val !== undefined && val !== "") {
          score += field.weight;
          present.push(field.label);
        } else {
          missing.push(field.label);
        }
      }
      const pct = Math.round((score / MAX_SCORE) * 100);
      const priority = priorityFromPct(pct, !!p.name);
      return {
        feature: f,
        name: p.name || "(Tanpa Nama)",
        level,
        score,
        maxScore: MAX_SCORE,
        pct,
        priority,
        missing,
        present,
        geomType: f.geometry.type,
      };
    })
    .sort((a, b) => a.score - b.score);
}

export default function StatsPanel({ features, onSelectSchool, onClose }: StatsPanelProps) {
  const stats = analyzeSchools(features);
  const total = stats.length;

  const byPriority: Record<Priority, SchoolStat[]> = { kritis: [], rendah: [], sedang: [], baik: [] };
  stats.forEach((s) => byPriority[s.priority].push(s));

  const fieldMissingCount = FIELDS.map((field) => ({
    label: field.label,
    key: field.key,
    missing: stats.filter((s) => s.missing.includes(field.label)).length,
    pct: Math.round((stats.filter((s) => s.missing.includes(field.label)).length / total) * 100),
  })).sort((a, b) => b.missing - a.missing);

  const avgCompletion = Math.round(stats.reduce((s, x) => s + x.pct, 0) / total);

  const byLevel: Partial<Record<SchoolLevel, number>> = {};
  stats.forEach((s) => { byLevel[s.level] = (byLevel[s.level] ?? 0) + 1; });

  const PRIORITY_ORDER: Priority[] = ["kritis", "rendah", "sedang", "baik"];

  return (
    <div
      className="absolute inset-y-4 right-4 z-[1001] w-80 flex flex-col"
      data-testid="stats-panel"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-slate-700 to-slate-800 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Statistik Kebutuhan Sekolah</div>
            <div className="text-xs text-slate-300 mt-0.5">Analisis kelengkapan data OSM</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            data-testid="button-stats-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 p-4">

          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 mb-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500 font-medium">Total Sekolah</span>
              </div>
              <div className="text-2xl font-bold text-slate-800">{total}</div>
              <div className="text-xs text-slate-400 mt-0.5">Dalam database OSM</div>
            </div>
            <div className={`rounded-xl p-3 border ${avgCompletion < 40 ? "bg-red-50 border-red-100" : avgCompletion < 70 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500 font-medium">Rata-rata Data</span>
              </div>
              <div className={`text-2xl font-bold ${avgCompletion < 40 ? "text-red-700" : avgCompletion < 70 ? "text-amber-700" : "text-emerald-700"}`}>{avgCompletion}%</div>
              <div className="text-xs text-slate-400 mt-0.5">Kelengkapan rata-rata</div>
            </div>
          </div>

          {/* Priority summary */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Status Prioritas</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRIORITY_ORDER.map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const count = byPriority[p].length;
                return (
                  <div key={p} className={`rounded-xl p-2.5 border ${cfg.bg} ${cfg.border}`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${cfg.color}`}>
                      {cfg.icon}
                      <span className="text-xs font-semibold">{cfg.label}</span>
                    </div>
                    <div className={`text-xl font-bold ${cfg.color}`}>{count}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">sekolah</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Missing fields analysis */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Kebutuhan Data</span>
            </div>
            <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
              {fieldMissingCount.map((f) => (
                <div key={f.key}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-xs text-slate-600">{f.label}</span>
                    <span className={`text-xs font-bold ${f.pct === 100 ? "text-red-600" : f.pct > 50 ? "text-orange-600" : "text-emerald-600"}`}>
                      {f.missing}/{total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${f.pct === 100 ? "bg-red-500" : f.pct > 50 ? "bg-orange-400" : "bg-emerald-500"}`}
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-1 border-t border-slate-200 text-[10px] text-slate-400">
                Angka menunjukkan sekolah yang belum memiliki data tersebut
              </div>
            </div>
          </div>

          {/* By level */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Per Jenjang</span>
            </div>
            <div className="space-y-1.5">
              {(Object.entries(byLevel) as [SchoolLevel, number][]).map(([level, count]) => {
                const cfg = SCHOOL_LEVEL_CONFIG[level];
                const levelStats = stats.filter((s) => s.level === level);
                const avgPct = Math.round(levelStats.reduce((s, x) => s + x.pct, 0) / levelStats.length);
                return (
                  <div key={level} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    <span className="text-base w-6 text-center">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.shortLabel}</span>
                        <span className="text-xs text-slate-500">{count} sekolah</span>
                      </div>
                      <div className="h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full`}
                          style={{ width: `${avgPct}%`, background: cfg.markerColor }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8 text-right">{avgPct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* School-by-school list ordered by priority */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Daftar Prioritas</span>
            </div>
            <div className="space-y-1.5">
              {stats.map((s, i) => {
                const pcfg = PRIORITY_CONFIG[s.priority];
                const scfg = SCHOOL_LEVEL_CONFIG[s.level];
                return (
                  <button
                    key={s.feature.properties.osm_id ?? i}
                    onClick={() => onSelectSchool(s.feature)}
                    className={`w-full text-left rounded-xl p-3 border transition-all hover:shadow-md ${pcfg.bg} ${pcfg.border}`}
                    data-testid={`button-stat-school-${i}`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-base flex-shrink-0">{scfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 leading-tight truncate">{s.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${pcfg.bg} ${pcfg.color} ${pcfg.border} flex items-center gap-1`}>
                            {pcfg.icon}
                            {pcfg.label}
                          </span>
                          <span className={`text-[10px] font-semibold ${scfg.color}`}>{scfg.shortLabel}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-sm font-bold ${pcfg.color}`}>{s.pct}%</div>
                        <div className="text-[10px] text-slate-400">lengkap</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${pcfg.bar}`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                    {/* Missing fields */}
                    {s.missing.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.missing.map((m) => (
                          <span key={m} className="text-[9px] px-1.5 py-0.5 bg-white/70 text-slate-500 rounded border border-slate-200">
                            ✗ {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 leading-relaxed">
                <strong>Catatan:</strong> Analisis ini berdasarkan kelengkapan data OpenStreetMap. Sekolah dengan skor rendah memerlukan survei lapangan untuk melengkapi data kapasitas, pengelola, dan aksesibilitas.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
