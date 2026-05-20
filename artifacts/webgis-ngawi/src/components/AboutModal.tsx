import { X, MapPin, Database, Layers, Github } from "lucide-react";

interface AboutModalProps {
  featureCount: number;
  onClose: () => void;
}

const FEATURES = [
  "Pencarian lokasi & alamat",
  "GPS real-time",
  "Panel info klik lokasi",
  "Kontrol lapisan peta",
  "Alat ukur jarak",
  "Beralih basemap (OSM / Satelit / Topo)",
  "Daftar & statistik sekolah",
  "Legenda peta interaktif",
  "Koordinat kursor real-time",
  "Mode layar penuh",
  "Bagikan lokasi via URL",
  "Cetak / ekspor peta",
];

export default function AboutModal({ featureCount, onClose }: AboutModalProps) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" data-testid="about-modal">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-700 via-green-700 to-teal-700 px-6 py-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            data-testid="button-about-close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">WebGIS Ngawi</h2>
              <p className="text-emerald-200 text-sm mt-0.5">
                Sistem Informasi Geografis Kab. Ngawi
              </p>
              <span className="inline-block mt-1.5 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                v2.0 — Jawa Timur, Indonesia
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <MapPin className="w-4 h-4" />, value: featureCount.toLocaleString(), label: "Fitur Spasial" },
              { icon: <Layers className="w-4 h-4" />, value: "5", label: "Lapisan Peta" },
              { icon: <Database className="w-4 h-4" />, value: "740 KB", label: "Ukuran Data" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100"
              >
                <div className="text-emerald-600 flex justify-center mb-1">{stat.icon}</div>
                <div className="text-lg font-bold text-gray-800">{stat.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">Tentang Aplikasi</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              WebGIS Ngawi adalah sistem informasi geografis interaktif untuk wilayah Kabupaten Ngawi, 
              Jawa Timur. Menampilkan data spasial meliputi sekolah, universitas, jalan, bangunan, 
              dan berbagai titik lokasi penting. Data bersumber dari OpenStreetMap.
            </p>
          </div>

          {/* Features list */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">Fitur Tersedia</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                  <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data source */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Github className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-700">Sumber Data</span>
            </div>
            <p className="text-xs text-gray-500">
              Data GeoJSON diekstrak dari{" "}
              <span className="font-semibold text-gray-700">OpenStreetMap</span>{" "}
              Kabupaten Ngawi, Jawa Timur. Koordinat WGS84 (EPSG:4326).
            </p>
          </div>
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
