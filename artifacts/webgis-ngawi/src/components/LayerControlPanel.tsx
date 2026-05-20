import { useState } from "react";
import { Layers, ChevronDown, ChevronUp, Eye, EyeOff, GraduationCap, Landmark, Route, Circle, Hexagon } from "lucide-react";

export interface LayerState {
  points: boolean;
  lines: boolean;
  polygons: boolean;
  schools: boolean;
  universities: boolean;
}

interface LayerControlPanelProps {
  layers: LayerState;
  onChange: (layers: LayerState) => void;
}

interface LayerItem {
  key: keyof LayerState;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
}

const layerItems: LayerItem[] = [
  {
    key: "schools",
    label: "Sekolah",
    sublabel: "SD, SMP, SMA, SMK",
    icon: <GraduationCap className="w-4 h-4" />,
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "universities",
    label: "Universitas",
    sublabel: "Perguruan tinggi",
    icon: <Landmark className="w-4 h-4" />,
    color: "text-purple-600 bg-purple-50",
  },
  {
    key: "lines",
    label: "Jalan",
    sublabel: "Rute & jalan",
    icon: <Route className="w-4 h-4" />,
    color: "text-orange-600 bg-orange-50",
  },
  {
    key: "polygons",
    label: "Area/Kawasan",
    sublabel: "Bangunan & zona",
    icon: <Hexagon className="w-4 h-4" />,
    color: "text-teal-600 bg-teal-50",
  },
  {
    key: "points",
    label: "Titik Lainnya",
    sublabel: "Lokasi umum",
    icon: <Circle className="w-4 h-4" />,
    color: "text-gray-600 bg-gray-50",
  },
];

export default function LayerControlPanel({ layers, onChange }: LayerControlPanelProps) {
  const [open, setOpen] = useState(false);

  const toggle = (key: keyof LayerState) => {
    onChange({ ...layers, [key]: !layers[key] });
  };

  const activeCount = Object.values(layers).filter(Boolean).length;

  return (
    <div className="absolute top-4 right-4 z-[1000]" data-testid="layer-control">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-3 w-full hover:bg-gray-50 transition-colors"
          data-testid="button-layer-toggle"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-left flex-1">
            <div className="text-sm font-semibold text-gray-800">Lapisan Peta</div>
            <div className="text-xs text-gray-400">{activeCount} dari {layerItems.length} aktif</div>
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {open && (
          <div className="border-t border-gray-100 p-2 space-y-0.5 w-56">
            {layerItems.map((item) => {
              const active = layers[item.key];
              return (
                <button
                  key={item.key}
                  onClick={() => toggle(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    active ? "bg-gray-50" : "opacity-50"
                  } hover:bg-gray-100`}
                  data-testid={`button-layer-${item.key}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-800">{item.label}</div>
                    <div className="text-xs text-gray-400">{item.sublabel}</div>
                  </div>
                  <div
                    className={`w-8 h-4 rounded-full transition-colors flex items-center ${
                      active ? "bg-emerald-500" : "bg-gray-200"
                    } px-0.5`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
                        active ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
