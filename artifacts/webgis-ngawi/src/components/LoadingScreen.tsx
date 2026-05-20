import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onDone: () => void;
}

export default function LoadingScreen({ onDone }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Memuat data peta...");

  useEffect(() => {
    const phases = [
      { p: 20, msg: "Memuat data peta..." },
      { p: 45, msg: "Memproses fitur GeoJSON..." },
      { p: 70, msg: "Menginisialisasi lapisan..." },
      { p: 90, msg: "Menyiapkan kontrol..." },
      { p: 100, msg: "Selesai!" },
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < phases.length) {
        setProgress(phases[i].p);
        setPhase(phases[i].msg);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onDone, 400);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: `${Math.random() * 200 + 50}px`,
              height: `${Math.random() * 200 + 50}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
            <svg viewBox="0 0 100 100" className="w-14 h-14 animate-spin-slow" fill="none">
              <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <path
                d="M50 10 L55 25 L70 20 L60 35 L75 40 L60 45 L65 60 L50 55 L35 65 L40 50 L25 55 L35 40 L20 35 L35 30 L30 15 Z"
                fill="rgba(255,255,255,0.7)"
              />
            </svg>
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-emerald-400/40 animate-ping" />
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">WebGIS Ngawi</h1>
          <p className="text-emerald-300 text-sm font-medium">Sistem Informasi Geografis Kabupaten Ngawi</p>
        </div>

        <div className="w-72 space-y-3">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-white/60 text-sm">{phase}</p>
        </div>

        <div className="flex gap-4 text-white/40 text-xs">
          <span>🌿 Jawa Timur, Indonesia</span>
          <span>·</span>
          <span>1.605 Fitur</span>
        </div>
      </div>
    </div>
  );
}
