import { X, Map } from "lucide-react";

interface MapLegendProps {
  onClose: () => void;
}

const LEGEND_ITEMS = [
  {
    group: "Pendidikan",
    items: [
      { color: "#0ea5e9", symbol: "pin", label: "SD (Sekolah Dasar)", emoji: "📚" },
      { color: "#7c3aed", symbol: "pin", label: "SMP (Menengah Pertama)", emoji: "📖" },
      { color: "#d97706", symbol: "pin", label: "SMA (Menengah Atas)", emoji: "🎓" },
      { color: "#ea580c", symbol: "pin", label: "SMK (Menengah Kejuruan)", emoji: "🔧" },
      { color: "#e11d48", symbol: "pin", label: "Akademi / AKPER", emoji: "🏥" },
      { color: "#7c3aed", symbol: "pin", label: "Universitas", emoji: "🏛️" },
    ],
  },
  {
    group: "Infrastruktur",
    items: [
      { color: "#f97316", symbol: "line", label: "Jalan / Rute", emoji: null },
      { color: "#0d9488", symbol: "polygon", label: "Area / Kawasan", emoji: null },
      { color: "#059669", symbol: "dot", label: "Titik Lokasi Lainnya", emoji: null },
    ],
  },
  {
    group: "Penanda Khusus",
    items: [
      { color: "#3b82f6", symbol: "dot-large", label: "Lokasi GPS Anda", emoji: "📍" },
    ],
  },
];

function Symbol({ color, symbol }: { color: string; symbol: string }) {
  if (symbol === "pin") {
    return (
      <div
        className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
        style={{ background: color }}
      />
    );
  }
  if (symbol === "line") {
    return (
      <div className="w-6 h-0 flex-shrink-0" style={{ borderTop: `3px solid ${color}`, borderRadius: 2 }} />
    );
  }
  if (symbol === "polygon") {
    return (
      <div
        className="w-5 h-4 flex-shrink-0 rounded-sm border-2"
        style={{ borderColor: color, background: `${color}25` }}
      />
    );
  }
  if (symbol === "dot-large") {
    return (
      <div
        className="w-4 h-4 rounded-full border-2 border-white shadow-md flex-shrink-0"
        style={{ background: color }}
      />
    );
  }
  return (
    <div
      className="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0"
      style={{ background: color }}
    />
  );
}

export default function MapLegend({ onClose }: MapLegendProps) {
  return (
    <div
      className="absolute bottom-6 left-20 z-[1001] w-60"
      data-testid="map-legend"
    >
      <div className="bg-white/97 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-700 to-teal-700">
          <Map className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white flex-1">Legenda Peta</span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            data-testid="button-legend-close"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {LEGEND_ITEMS.map((group) => (
            <div key={group.group}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 px-1">
                {group.group}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-6 flex items-center justify-center flex-shrink-0">
                      <Symbol color={item.color} symbol={item.symbol} />
                    </div>
                    <span className="text-xs text-gray-700 leading-tight">
                      {item.emoji && <span className="mr-1">{item.emoji}</span>}
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-400 text-center">
            Sumber: OpenStreetMap Ngawi
          </p>
        </div>
      </div>
    </div>
  );
}
