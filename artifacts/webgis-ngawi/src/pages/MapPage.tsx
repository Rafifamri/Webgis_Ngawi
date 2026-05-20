import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import LoadingScreen from "@/components/LoadingScreen";
import SearchPanel from "@/components/SearchPanel";
import InfoPanel from "@/components/InfoPanel";
import LayerControlPanel, { LayerState } from "@/components/LayerControlPanel";
import SchoolListPanel, { getSchoolLevel, SCHOOL_LEVEL_CONFIG, SchoolLevel } from "@/components/SchoolListPanel";
import StatsPanel from "@/components/StatsPanel";
import {
  Search,
  Locate,
  LocateFixed,
  Map as MapIcon,
  Info,
  X,
  GraduationCap,
  BarChart3,
} from "lucide-react";

export interface GeoFeature {
  type: string;
  geometry: {
    type: "Point" | "LineString" | "Polygon";
    coordinates: number[] | number[][] | number[][][];
  };
  properties: {
    osm_id: number;
    osm_type: string | null;
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

const NGAWI_CENTER: [number, number] = [-7.4044, 111.4465];
const NGAWI_ZOOM = 14;
const BASE_URL = import.meta.env.BASE_URL ?? "/";

function getFeatureCenter(geometry: GeoFeature["geometry"]): [number, number] | null {
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

function makeSchoolMarkerHtml(level: SchoolLevel): string {
  const cfg = SCHOOL_LEVEL_CONFIG[level];
  return `
    <div style="
      width:32px;height:32px;
      background:${cfg.markerColor};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:3px solid white;
      box-shadow:0 3px 10px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="transform:rotate(45deg);font-size:14px;line-height:26px;text-align:center;user-select:none;">${cfg.emoji}</div>
    </div>
  `;
}

function makePopupContent(props: GeoFeature["properties"]): string {
  const level = getSchoolLevel(props.name, props.amenity);
  const cfg = SCHOOL_LEVEL_CONFIG[level];
  const isSchool = props.amenity === "school" || props.amenity === "university";

  const name = props.name || "Fitur Tanpa Nama";
  const operatorRow = props.operator
    ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;"><span style="color:#999;">Pengelola</span><span style="text-align:right;font-weight:500;font-size:11px;">${props.operator}</span></div>`
    : "";
  const idRow = props.osm_id
    ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;"><span style="color:#999;">OSM ID</span><span style="font-family:monospace;font-size:11px;">${props.osm_id}</span></div>`
    : "";

  const badgeStyle = isSchool
    ? `background:${cfg.markerColor}18;color:${cfg.markerColor};border:1px solid ${cfg.markerColor}40;`
    : "background:#e8f5e9;color:#2e7d32;";

  const badgeText = isSchool ? `${cfg.emoji} ${cfg.label}` : (
    props.amenity === "university" ? "🏛️ Universitas" : ""
  );

  return `
    <div style="font-family:'Inter',system-ui,sans-serif;min-width:200px;max-width:260px;">
      <div style="padding:12px 14px 10px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:600;color:#1a2e1a;line-height:1.3;margin-bottom:6px;">${name}</div>
        ${badgeText ? `<span style="display:inline-block;font-size:11px;font-weight:500;padding:3px 10px;border-radius:99px;${badgeStyle}">${badgeText}</span>` : ""}
      </div>
      <div style="padding:8px 14px 12px;font-size:12px;color:#555;line-height:1.9;">
        ${operatorRow}${idRow}
      </div>
    </div>
  `;
}

const TILE_LAYERS = [
  {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: "satellite",
    label: "Satelit (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "topo",
    label: "Topografi",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
];

export default function MapPage() {
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoFeature[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showBasemap, setShowBasemap] = useState(false);
  const [showSchoolList, setShowSchoolList] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<GeoFeature | null>(null);
  const [selectedLatlng, setSelectedLatlng] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentBasemap, setCurrentBasemap] = useState("osm");
  const [mapReady, setMapReady] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    points: true,
    lines: true,
    polygons: true,
    schools: true,
    universities: true,
  });
  const [featureCount, setFeatureCount] = useState({ total: 0, visible: 0 });

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const gpsCircleRef = useRef<L.Circle | null>(null);
  const layerGroupsRef = useRef<{
    points: L.LayerGroup;
    lines: L.LayerGroup;
    polygons: L.LayerGroup;
    schools: L.LayerGroup;
    universities: L.LayerGroup;
  } | null>(null);
  const dataLoadedRef = useRef(false);

  const handleLoadingDone = useCallback(async () => {
    const base = BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/";
    try {
      const res = await fetch(`${base}data/ngawi.geojson`);
      const json = await res.json();
      setGeoData(json.features as GeoFeature[]);
    } catch (e) {
      console.error("Failed to load GeoJSON", e);
    }
    setLoading(false);
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: NGAWI_CENTER,
      zoom: NGAWI_ZOOM,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const tile = L.tileLayer(TILE_LAYERS[0].url, {
      attribution: TILE_LAYERS[0].attribution,
      maxZoom: 19,
    });
    tile.addTo(map);
    tileLayerRef.current = tile;

    const groups = {
      points: L.layerGroup().addTo(map),
      lines: L.layerGroup().addTo(map),
      polygons: L.layerGroup().addTo(map),
      schools: L.layerGroup().addTo(map),
      universities: L.layerGroup().addTo(map),
    };
    layerGroupsRef.current = groups;
    mapRef.current = map;
    setMapReady(true);
  }, []);

  const populateLayers = useCallback((features: GeoFeature[]) => {
    const groups = layerGroupsRef.current;
    if (!groups || dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    // School icons by level
    function makeSchoolIcon(level: SchoolLevel, size: number = 32): L.DivIcon {
      return L.divIcon({
        className: "",
        html: makeSchoolMarkerHtml(level),
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -(size + 4)],
      });
    }

    const pointIcon = L.divIcon({
      className: "",
      html: `<div style="width:10px;height:10px;background:#059669;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
      popupAnchor: [0, -8],
    });

    let total = 0;
    let visible = 0;

    features.forEach((feature) => {
      total++;
      const geom = feature.geometry;
      const props = feature.properties;
      const popupContent = makePopupContent(props);

      const handleClick = (latlng: L.LatLng) => {
        setSelectedFeature(feature);
        setSelectedLatlng({ lat: latlng.lat, lng: latlng.lng });
        setShowInfo(true);
        setShowSchoolList(false);
      };

      const isSchoolFeature =
        props.amenity === "school" || props.amenity === "university";

      if (geom.type === "Point") {
        const coords = geom.coordinates as number[];
        const latlng: [number, number] = [coords[1], coords[0]];

        if (isSchoolFeature) {
          const level =
            props.amenity === "university"
              ? "UNIVERSITAS"
              : getSchoolLevel(props.name, props.amenity);
          const size = props.amenity === "university" ? 36 : 32;
          const icon = makeSchoolIcon(level, size);
          const marker = L.marker(latlng, { icon });
          marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 });
          marker.on("click", (e) => handleClick(e.latlng));
          const group =
            props.amenity === "university" ? groups.universities : groups.schools;
          marker.addTo(group);
        } else {
          const marker = L.marker(latlng, { icon: pointIcon });
          marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 });
          marker.on("click", (e) => handleClick(e.latlng));
          marker.addTo(groups.points);
        }
        visible++;
      } else if (geom.type === "LineString") {
        const coords = geom.coordinates as number[][];
        const latlngs = coords.map((c) => [c[1], c[0]] as [number, number]);
        const line = L.polyline(latlngs, {
          color: "#f97316",
          weight: 3,
          opacity: 0.75,
          lineCap: "round",
          lineJoin: "round",
        });
        line.bindPopup(popupContent);
        line.on("click", (e) => handleClick(e.latlng));
        line.addTo(groups.lines);
        visible++;
      } else if (geom.type === "Polygon") {
        const rings = geom.coordinates as number[][][];
        const latlngs = rings.map((ring) =>
          ring.map((c) => [c[1], c[0]] as [number, number])
        );

        if (isSchoolFeature) {
          // School polygons: colored outline + center marker
          const level =
            props.amenity === "university"
              ? "UNIVERSITAS"
              : getSchoolLevel(props.name, props.amenity);
          const cfg = SCHOOL_LEVEL_CONFIG[level];
          const group =
            props.amenity === "university" ? groups.universities : groups.schools;

          const poly = L.polygon(latlngs, {
            color: cfg.markerColor,
            weight: 2,
            fillColor: cfg.markerColor,
            fillOpacity: 0.15,
            opacity: 0.8,
          });
          poly.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 });
          poly.on("click", (e) => handleClick(e.latlng));
          poly.addTo(group);

          // Center marker for the polygon
          const ring = rings[0];
          const lats = ring.map((c) => c[1]);
          const lngs2 = ring.map((c) => c[0]);
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centerLng = (Math.min(...lngs2) + Math.max(...lngs2)) / 2;
          const size = props.amenity === "university" ? 36 : 32;
          const icon = makeSchoolIcon(level, size);
          const marker = L.marker([centerLat, centerLng], { icon });
          marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 });
          marker.on("click", (e) => handleClick(e.latlng));
          marker.addTo(group);
        } else {
          const poly = L.polygon(latlngs, {
            color: "#0d9488",
            weight: 2,
            fillColor: "#0d9488",
            fillOpacity: 0.18,
            opacity: 0.7,
          });
          poly.bindPopup(popupContent);
          poly.on("click", (e) => handleClick(e.latlng));
          poly.addTo(groups.polygons);
        }
        visible++;
      }
    });

    setFeatureCount({ total, visible });
  }, []);

  useEffect(() => {
    if (!loading && !mapRef.current) {
      setTimeout(initMap, 100);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        dataLoadedRef.current = false;
      }
    };
  }, [loading, initMap]);

  useEffect(() => {
    if (mapReady && geoData.length > 0) {
      populateLayers(geoData);
    }
  }, [mapReady, geoData, populateLayers]);

  useEffect(() => {
    const groups = layerGroupsRef.current;
    const map = mapRef.current;
    if (!groups || !map) return;
    const toggle = (group: L.LayerGroup, active: boolean) => {
      if (active) { if (!map.hasLayer(group)) map.addLayer(group); }
      else { if (map.hasLayer(group)) map.removeLayer(group); }
    };
    toggle(groups.schools, layers.schools);
    toggle(groups.universities, layers.universities);
    toggle(groups.lines, layers.lines);
    toggle(groups.polygons, layers.polygons);
    toggle(groups.points, layers.points);
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = TILE_LAYERS.find((l) => l.id === currentBasemap);
    if (!layer) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const tile = L.tileLayer(layer.url, { attribution: layer.attribution, maxZoom: 19 });
    tile.addTo(map);
    tile.bringToBack();
    tileLayerRef.current = tile;
    setShowBasemap(false);
  }, [currentBasemap]);

  const handleGPS = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gpsActive) {
      if (gpsMarkerRef.current) { map.removeLayer(gpsMarkerRef.current); gpsMarkerRef.current = null; }
      if (gpsCircleRef.current) { map.removeLayer(gpsCircleRef.current); gpsCircleRef.current = null; }
      setGpsActive(false);
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        if (gpsMarkerRef.current) map.removeLayer(gpsMarkerRef.current);
        if (gpsCircleRef.current) map.removeLayer(gpsCircleRef.current);
        const circle = L.circle([lat, lng], { radius: accuracy, color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08, weight: 1 });
        circle.addTo(map);
        gpsCircleRef.current = circle;
        const gpsIcon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:18px;height:18px;"><div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6);"></div></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([lat, lng], { icon: gpsIcon });
        marker.bindPopup(`<div style="font-family:'Inter',system-ui,sans-serif;padding:12px;text-align:center;"><div style="font-size:13px;font-weight:600;color:#1a2e1a;margin-bottom:6px;">Lokasi Anda</div><div style="font-size:11px;color:#666;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div><div style="font-size:11px;color:#999;margin-top:2px;">Akurasi: ±${Math.round(accuracy)}m</div></div>`);
        marker.addTo(map);
        gpsMarkerRef.current = marker;
        map.flyTo([lat, lng], 16, { duration: 1.5 });
        setGpsActive(true);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        alert("Tidak dapat mengakses lokasi. Pastikan GPS aktif dan izin lokasi diberikan.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [gpsActive]);

  const handleSearchSelect = useCallback((feature: GeoFeature) => {
    const map = mapRef.current;
    if (!map) return;
    const center = getFeatureCenter(feature.geometry);
    if (!center) return;
    map.flyTo(center, 17, { duration: 1.2 });
    setSelectedFeature(feature);
    setSelectedLatlng({ lat: center[0], lng: center[1] });
    setShowInfo(true);
  }, []);

  const handleSchoolSelect = useCallback((feature: GeoFeature) => {
    const map = mapRef.current;
    if (!map) return;
    const center = getFeatureCenter(feature.geometry);
    if (!center) return;
    map.flyTo(center, 17, { duration: 1.2 });
    setSelectedFeature(feature);
    setSelectedLatlng({ lat: center[0], lng: center[1] });
    setShowInfo(true);
    setShowSchoolList(false);
  }, []);

  const schoolCount = geoData.filter(
    (f) => f.properties.amenity === "school" || f.properties.amenity === "university"
  ).length;

  if (loading) {
    return <LoadingScreen onDone={handleLoadingDone} />;
  }

  return (
    <div className="relative w-full h-full" data-testid="map-page">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" data-testid="map-container" />

      {/* Header badge */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 px-3 py-2.5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <MapIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 leading-none">WebGIS Ngawi</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {featureCount.visible > 0 ? `${featureCount.visible} fitur dimuat` : "Memuat..."}
            </div>
          </div>
        </div>
      </div>

      {/* Search trigger */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999]">
        {!showSearch && (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 px-5 py-2.5 text-sm text-gray-500 hover:text-gray-800 hover:shadow-2xl transition-all"
            data-testid="button-search-open"
          >
            <Search className="w-4 h-4" />
            <span>Cari lokasi di Ngawi...</span>
          </button>
        )}
      </div>

      {/* Search panel */}
      {showSearch && (
        <SearchPanel
          features={geoData}
          onSelect={handleSearchSelect}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Layer control — only show when no right panel is open */}
      {!showSchoolList && !showStats && (
        <LayerControlPanel layers={layers} onChange={setLayers} />
      )}

      {/* School list panel */}
      {showSchoolList && !showStats && (
        <SchoolListPanel
          features={geoData}
          onSelect={handleSchoolSelect}
          onClose={() => setShowSchoolList(false)}
        />
      )}

      {/* Stats panel */}
      {showStats && (
        <StatsPanel
          features={geoData}
          onSelectSchool={(f) => {
            const feature = f as GeoFeature;
            const center = getFeatureCenter(feature.geometry);
            if (center && mapRef.current) mapRef.current.flyTo(center, 17, { duration: 1.2 });
            setSelectedFeature(feature);
            setSelectedLatlng(center ? { lat: center[0], lng: center[1] } : null);
            setShowInfo(true);
            setShowStats(false);
          }}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* Left controls: GPS + Basemap + Schools */}
      <div className="absolute left-4 bottom-6 z-[1000] flex flex-col gap-2">
        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          className={`w-11 h-11 rounded-2xl shadow-xl border flex items-center justify-center transition-all ${
            gpsActive
              ? "bg-blue-600 border-blue-500 text-white shadow-blue-200"
              : "bg-white/95 backdrop-blur-sm border-white/60 text-gray-600 hover:text-blue-600 hover:border-blue-200"
          } ${gpsLoading ? "animate-pulse" : ""}`}
          title={gpsActive ? "Nonaktifkan GPS" : "Aktifkan GPS"}
          data-testid="button-gps"
        >
          {gpsActive ? <LocateFixed className="w-5 h-5" /> : <Locate className="w-5 h-5" />}
        </button>

        <button
          onClick={() => setShowBasemap((v) => !v)}
          className={`w-11 h-11 rounded-2xl shadow-xl border flex items-center justify-center transition-all ${
            showBasemap
              ? "bg-emerald-600 border-emerald-500 text-white"
              : "bg-white/95 backdrop-blur-sm border-white/60 text-gray-600 hover:text-emerald-600 hover:border-emerald-200"
          }`}
          title="Ganti Basemap"
          data-testid="button-basemap"
        >
          <MapIcon className="w-4 h-4" />
        </button>

        {/* School list toggle */}
        <button
          onClick={() => {
            setShowSchoolList((v) => !v);
            setShowStats(false);
            setShowBasemap(false);
          }}
          className={`w-11 h-11 rounded-2xl shadow-xl border flex items-center justify-center transition-all relative ${
            showSchoolList
              ? "bg-emerald-600 border-emerald-500 text-white"
              : "bg-white/95 backdrop-blur-sm border-white/60 text-gray-600 hover:text-emerald-600 hover:border-emerald-200"
          }`}
          title="Daftar Sekolah"
          data-testid="button-school-list"
        >
          <GraduationCap className="w-5 h-5" />
          {schoolCount > 0 && !showSchoolList && !showStats && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {schoolCount}
            </span>
          )}
        </button>

        {/* Statistics toggle */}
        <button
          onClick={() => {
            setShowStats((v) => !v);
            setShowSchoolList(false);
            setShowBasemap(false);
          }}
          className={`w-11 h-11 rounded-2xl shadow-xl border flex items-center justify-center transition-all ${
            showStats
              ? "bg-slate-700 border-slate-600 text-white"
              : "bg-white/95 backdrop-blur-sm border-white/60 text-gray-600 hover:text-slate-700 hover:border-slate-300"
          }`}
          title="Statistik Kebutuhan Sekolah"
          data-testid="button-stats"
        >
          <BarChart3 className="w-5 h-5" />
        </button>
      </div>

      {/* Basemap selector */}
      {showBasemap && (
        <div
          className="absolute left-20 bottom-6 z-[1000] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/60 overflow-hidden w-48"
          data-testid="basemap-panel"
        >
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Pilih Basemap</span>
            <button onClick={() => setShowBasemap(false)} data-testid="button-basemap-close">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          {TILE_LAYERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setCurrentBasemap(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                currentBasemap === t.id ? "text-emerald-700 font-semibold bg-emerald-50/50" : "text-gray-700"
              }`}
              data-testid={`button-basemap-${t.id}`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${currentBasemap === t.id ? "bg-emerald-600" : "bg-gray-200"}`} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Info panel */}
      {showInfo && selectedFeature && selectedLatlng && (
        <InfoPanel
          feature={selectedFeature}
          latlng={selectedLatlng}
          onClose={() => setShowInfo(false)}
        />
      )}

      {/* Hint */}
      <div className="absolute bottom-6 right-16 z-[999]">
        <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/60 shadow-sm">
          <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">Klik fitur untuk info</span>
        </div>
      </div>

      {/* School type legend — shown when school list is open */}
      {showSchoolList && (
        <div className="absolute bottom-6 left-20 z-[999]">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/60 px-3 py-2">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Legenda Sekolah</div>
            <div className="flex flex-col gap-1">
              {(["SD","SMP","SMA","SMK","AKPER","UNIVERSITAS"] as const).map((level) => {
                const cfg = SCHOOL_LEVEL_CONFIG[level];
                return (
                  <div key={level} className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                      style={{ background: cfg.markerColor }}
                    />
                    <span className="text-xs text-gray-700">
                      {cfg.emoji} {cfg.shortLabel} — {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
