import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import LoadingScreen from "@/components/LoadingScreen";
import SearchPanel from "@/components/SearchPanel";
import InfoPanel from "@/components/InfoPanel";
import LayerControlPanel, { LayerState } from "@/components/LayerControlPanel";
import SchoolListPanel, { getSchoolLevel, SCHOOL_LEVEL_CONFIG, SchoolLevel } from "@/components/SchoolListPanel";
import StatsPanel from "@/components/StatsPanel";
import MapLegend from "@/components/MapLegend";
import AboutModal from "@/components/AboutModal";
import {
  Search, Locate, LocateFixed, Map as MapIcon, Info, X,
  GraduationCap, BarChart3, Home, Maximize, Minimize,
  Ruler, BookOpen, Share2, Printer, HelpCircle, Layers,
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
    return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  }
  return null;
}

function makeSchoolMarkerHtml(level: SchoolLevel): string {
  const cfg = SCHOOL_LEVEL_CONFIG[level];
  return `<div style="width:32px;height:32px;background:${cfg.markerColor};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);font-size:14px;line-height:26px;text-align:center;user-select:none;">${cfg.emoji}</div></div>`;
}

function makePopupContent(props: GeoFeature["properties"]): string {
  const level = getSchoolLevel(props.name, props.amenity);
  const cfg = SCHOOL_LEVEL_CONFIG[level];
  const isSchool = props.amenity === "school" || props.amenity === "university";
  const name = props.name || "Fitur Tanpa Nama";
  const operatorRow = props.operator ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;"><span style="color:#999;">Pengelola</span><span style="text-align:right;font-weight:500;font-size:11px;">${props.operator}</span></div>` : "";
  const idRow = props.osm_id ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;"><span style="color:#999;">OSM ID</span><span style="font-family:monospace;font-size:11px;">${props.osm_id}</span></div>` : "";
  const badgeStyle = isSchool ? `background:${cfg.markerColor}18;color:${cfg.markerColor};border:1px solid ${cfg.markerColor}40;` : "background:#e8f5e9;color:#2e7d32;";
  const badgeText = isSchool ? `${cfg.emoji} ${cfg.label}` : "";
  return `<div style="font-family:'Inter',system-ui,sans-serif;min-width:200px;max-width:260px;"><div style="padding:12px 14px 10px;border-bottom:1px solid #f0f0f0;"><div style="font-size:14px;font-weight:600;color:#1a2e1a;line-height:1.3;margin-bottom:6px;">${name}</div>${badgeText ? `<span style="display:inline-block;font-size:11px;font-weight:500;padding:3px 10px;border-radius:99px;${badgeStyle}">${badgeText}</span>` : ""}</div><div style="padding:8px 14px 12px;font-size:12px;color:#555;line-height:1.9;">${operatorRow}${idRow}</div></div>`;
}

const TILE_LAYERS = [
  { id: "osm", label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  { id: "satellite", label: "Satelit (Esri)", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles &copy; Esri" },
  { id: "topo", label: "Topografi", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>' },
];

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export default function MapPage() {
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState<GeoFeature[]>([]);

  // Panel visibility
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showBasemap, setShowBasemap] = useState(false);
  const [showSchoolList, setShowSchoolList] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLayerControl, setShowLayerControl] = useState(false);

  // Feature state
  const [selectedFeature, setSelectedFeature] = useState<GeoFeature | null>(null);
  const [selectedLatlng, setSelectedLatlng] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentBasemap, setCurrentBasemap] = useState("osm");
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureDistance, setMeasureDistance] = useState(0);
  const [measurePoints, setMeasurePoints] = useState(0);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [featureCount, setFeatureCount] = useState({ total: 0, visible: 0 });
  const [layers, setLayers] = useState<LayerState>({ points: true, lines: true, polygons: true, schools: true, universities: true });

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const gpsCircleRef = useRef<L.Circle | null>(null);
  const layerGroupsRef = useRef<{ points: L.LayerGroup; lines: L.LayerGroup; polygons: L.LayerGroup; schools: L.LayerGroup; universities: L.LayerGroup } | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const measurePointsRef = useRef<L.LatLng[]>([]);
  const measureDistanceRef = useRef(0);
  const dataLoadedRef = useRef(false);

  const handleLoadingDone = useCallback(async () => {
    const base = BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/";
    try {
      const res = await fetch(`${base}data/ngawi.geojson`);
      const json = await res.json();
      setGeoData(json.features as GeoFeature[]);
    } catch (e) { console.error("Failed to load GeoJSON", e); }
    setLoading(false);
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    // Restore view from shared URL params
    const params = new URLSearchParams(window.location.search);
    const initLat = parseFloat(params.get("lat") ?? "");
    const initLng = parseFloat(params.get("lng") ?? "");
    const initZoom = parseInt(params.get("zoom") ?? "");
    const startCenter: [number, number] = (!isNaN(initLat) && !isNaN(initLng)) ? [initLat, initLng] : NGAWI_CENTER;
    const startZoom = !isNaN(initZoom) ? initZoom : NGAWI_ZOOM;
    const map = L.map(mapContainerRef.current, { center: startCenter, zoom: startZoom, zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: false, metric: true }).addTo(map);

    const tile = L.tileLayer(TILE_LAYERS[0].url, { attribution: TILE_LAYERS[0].attribution, maxZoom: 19 });
    tile.addTo(map);
    tileLayerRef.current = tile;

    const groups = {
      points: L.layerGroup().addTo(map), lines: L.layerGroup().addTo(map),
      polygons: L.layerGroup().addTo(map), schools: L.layerGroup().addTo(map),
      universities: L.layerGroup().addTo(map),
    };
    layerGroupsRef.current = groups;

    const measureLayer = L.layerGroup().addTo(map);
    measureLayerRef.current = measureLayer;

    // Cursor coordinate tracking
    map.on("mousemove", (e) => setCursorCoords({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.on("mouseout", () => setCursorCoords(null));

    mapRef.current = map;
    setMapReady(true);
  }, []);

  const populateLayers = useCallback((features: GeoFeature[]) => {
    const groups = layerGroupsRef.current;
    if (!groups || dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    function makeSchoolIcon(level: SchoolLevel, size = 32): L.DivIcon {
      return L.divIcon({ className: "", html: makeSchoolMarkerHtml(level), iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -(size + 4)] });
    }
    const pointIcon = L.divIcon({ className: "", html: `<div style="width:10px;height:10px;background:#059669;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`, iconSize: [10, 10], iconAnchor: [5, 5], popupAnchor: [0, -8] });

    let total = 0, visible = 0;
    features.forEach((feature) => {
      total++;
      const geom = feature.geometry, props = feature.properties;
      const popupContent = makePopupContent(props);
      const isSchoolFeature = props.amenity === "school" || props.amenity === "university";
      const handleClick = (latlng: L.LatLng) => { setSelectedFeature(feature); setSelectedLatlng({ lat: latlng.lat, lng: latlng.lng }); setShowInfo(true); setShowSchoolList(false); setShowStats(false); };

      if (geom.type === "Point") {
        const coords = geom.coordinates as number[];
        const latlng: [number, number] = [coords[1], coords[0]];
        if (isSchoolFeature) {
          const level = props.amenity === "university" ? "UNIVERSITAS" : getSchoolLevel(props.name, props.amenity);
          const size = props.amenity === "university" ? 36 : 32;
          const marker = L.marker(latlng, { icon: makeSchoolIcon(level, size) });
          marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 });
          marker.on("click", (e) => handleClick(e.latlng));
          marker.addTo(props.amenity === "university" ? groups.universities : groups.schools);
        } else {
          const marker = L.marker(latlng, { icon: pointIcon });
          marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 });
          marker.on("click", (e) => handleClick(e.latlng));
          marker.addTo(groups.points);
        }
        visible++;
      } else if (geom.type === "LineString") {
        const coords = geom.coordinates as number[][];
        const line = L.polyline(coords.map((c) => [c[1], c[0]] as [number, number]), { color: "#f97316", weight: 3, opacity: 0.75, lineCap: "round", lineJoin: "round" });
        line.bindPopup(popupContent); line.on("click", (e) => handleClick(e.latlng)); line.addTo(groups.lines); visible++;
      } else if (geom.type === "Polygon") {
        const rings = geom.coordinates as number[][][];
        const latlngs = rings.map((ring) => ring.map((c) => [c[1], c[0]] as [number, number]));
        if (isSchoolFeature) {
          const level = props.amenity === "university" ? "UNIVERSITAS" : getSchoolLevel(props.name, props.amenity);
          const cfg = SCHOOL_LEVEL_CONFIG[level];
          const group = props.amenity === "university" ? groups.universities : groups.schools;
          const poly = L.polygon(latlngs, { color: cfg.markerColor, weight: 2, fillColor: cfg.markerColor, fillOpacity: 0.15, opacity: 0.8 });
          poly.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 }); poly.on("click", (e) => handleClick(e.latlng)); poly.addTo(group);
          const ring = rings[0], lats = ring.map((c) => c[1]), lngs2 = ring.map((c) => c[0]);
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2, centerLng = (Math.min(...lngs2) + Math.max(...lngs2)) / 2;
          const size = props.amenity === "university" ? 36 : 32;
          const marker = L.marker([centerLat, centerLng], { icon: makeSchoolIcon(level, size) });
          marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 }); marker.on("click", (e) => handleClick(e.latlng)); marker.addTo(group);
        } else {
          const poly = L.polygon(latlngs, { color: "#0d9488", weight: 2, fillColor: "#0d9488", fillOpacity: 0.18, opacity: 0.7 });
          poly.bindPopup(popupContent); poly.on("click", (e) => handleClick(e.latlng)); poly.addTo(groups.polygons);
        }
        visible++;
      }
    });
    setFeatureCount({ total, visible });
  }, []);

  // Measure tool: click handler on map
  useEffect(() => {
    const map = mapRef.current;
    const measureLayer = measureLayerRef.current;
    if (!map || !measureLayer) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!measureMode) return;
      const latlng = e.latlng;
      const pts = measurePointsRef.current;
      pts.push(latlng);

      L.circleMarker(latlng, { radius: 5, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }).addTo(measureLayer);

      if (pts.length > 1) {
        const prev = pts[pts.length - 2];
        const segDist = prev.distanceTo(latlng);
        measureDistanceRef.current += segDist;
        setMeasureDistance(measureDistanceRef.current);
        L.polyline([prev, latlng], { color: "#ef4444", weight: 2.5, dashArray: "6,4", opacity: 0.9 }).addTo(measureLayer);
      }
      setMeasurePoints(pts.length);
    };

    map.on("click", onMapClick);
    return () => { map.off("click", onMapClick); };
  }, [measureMode, mapReady]);

  // Toggle measure mode: clear when turning off
  const toggleMeasure = useCallback(() => {
    if (measureMode) {
      measureLayerRef.current?.clearLayers();
      measurePointsRef.current = [];
      measureDistanceRef.current = 0;
      setMeasureDistance(0);
      setMeasurePoints(0);
    }
    setMeasureMode((v) => !v);
    setShowBasemap(false);
  }, [measureMode]);

  useEffect(() => {
    if (!loading && !mapRef.current) setTimeout(initMap, 100);
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; dataLoadedRef.current = false; } };
  }, [loading, initMap]);

  useEffect(() => { if (mapReady && geoData.length > 0) populateLayers(geoData); }, [mapReady, geoData, populateLayers]);

  useEffect(() => {
    const groups = layerGroupsRef.current, map = mapRef.current;
    if (!groups || !map) return;
    const toggle = (group: L.LayerGroup, active: boolean) => { if (active) { if (!map.hasLayer(group)) map.addLayer(group); } else { if (map.hasLayer(group)) map.removeLayer(group); } };
    toggle(groups.schools, layers.schools); toggle(groups.universities, layers.universities);
    toggle(groups.lines, layers.lines); toggle(groups.polygons, layers.polygons); toggle(groups.points, layers.points);
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = TILE_LAYERS.find((l) => l.id === currentBasemap);
    if (!layer) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const tile = L.tileLayer(layer.url, { attribution: layer.attribution, maxZoom: 19 });
    tile.addTo(map); tile.bringToBack();
    tileLayerRef.current = tile;
    setShowBasemap(false);
  }, [currentBasemap]);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleGPS = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gpsActive) {
      if (gpsMarkerRef.current) { map.removeLayer(gpsMarkerRef.current); gpsMarkerRef.current = null; }
      if (gpsCircleRef.current) { map.removeLayer(gpsCircleRef.current); gpsCircleRef.current = null; }
      setGpsActive(false); return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        if (gpsMarkerRef.current) map.removeLayer(gpsMarkerRef.current);
        if (gpsCircleRef.current) map.removeLayer(gpsCircleRef.current);
        L.circle([lat, lng], { radius: accuracy, color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08, weight: 1 }).addTo(map);
        gpsCircleRef.current = L.circle([lat, lng], { radius: accuracy, color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08, weight: 1 });
        const gpsIcon = L.divIcon({ className: "", html: `<div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6);"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
        const marker = L.marker([lat, lng], { icon: gpsIcon });
        marker.bindPopup(`<div style="font-family:'Inter',system-ui,sans-serif;padding:12px;text-align:center;"><div style="font-size:13px;font-weight:600;color:#1a2e1a;margin-bottom:6px;">Lokasi Anda</div><div style="font-size:11px;color:#666;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div><div style="font-size:11px;color:#999;margin-top:2px;">Akurasi: ±${Math.round(accuracy)}m</div></div>`);
        marker.addTo(map); gpsMarkerRef.current = marker;
        map.flyTo([lat, lng], 16, { duration: 1.5 });
        setGpsActive(true); setGpsLoading(false);
      },
      () => { setGpsLoading(false); alert("Tidak dapat mengakses lokasi."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [gpsActive]);

  const handleHome = useCallback(() => {
    mapRef.current?.flyTo(NGAWI_CENTER, NGAWI_ZOOM, { duration: 1.2 });
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleShare = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const url = `${window.location.origin}${window.location.pathname}?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}&zoom=${zoom}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    });
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleSearchSelect = useCallback((feature: GeoFeature) => {
    const map = mapRef.current;
    if (!map) return;
    const center = getFeatureCenter(feature.geometry);
    if (!center) return;
    map.flyTo(center, 17, { duration: 1.2 });
    setSelectedFeature(feature); setSelectedLatlng({ lat: center[0], lng: center[1] }); setShowInfo(true);
  }, []);

  const handleSchoolSelect = useCallback((feature: GeoFeature) => {
    const map = mapRef.current;
    if (!map) return;
    const center = getFeatureCenter(feature.geometry);
    if (!center) return;
    map.flyTo(center, 17, { duration: 1.2 });
    setSelectedFeature(feature); setSelectedLatlng({ lat: center[0], lng: center[1] }); setShowInfo(true); setShowSchoolList(false);
  }, []);

  const closeRightPanels = () => { setShowSchoolList(false); setShowStats(false); setShowLayerControl(false); };
  const schoolCount = geoData.filter((f) => f.properties.amenity === "school" || f.properties.amenity === "university").length;

  if (loading) return <LoadingScreen onDone={handleLoadingDone} />;

  return (
    <div className="relative w-full h-full" data-testid="map-page">
      {/* MAP */}
      <div
        ref={mapContainerRef}
        className={`absolute inset-0 z-0 ${measureMode ? "cursor-crosshair" : ""}`}
        data-testid="map-container"
      />

      {/* TOP LEFT: Brand badge */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 px-3 py-2 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <MapIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 leading-none">WebGIS Ngawi</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {featureCount.visible > 0 ? `${featureCount.visible} fitur` : "Memuat..."}
            </div>
          </div>
        </div>
      </div>

      {/* TOP CENTER: Search bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999]">
        {!showSearch && (
          <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/60 px-5 py-2.5 text-sm text-gray-500 hover:text-gray-800 transition-all" data-testid="button-search-open">
            <Search className="w-4 h-4" />
            <span>Cari lokasi atau alamat...</span>
          </button>
        )}
      </div>
      {showSearch && (
        <SearchPanel
          features={geoData}
          onSelect={handleSearchSelect}
          onSelectCoords={(lat, lng, label) => {
            mapRef.current?.flyTo([lat, lng], 16, { duration: 1.2 });
            setSelectedFeature(null);
            setSelectedLatlng({ lat, lng });
            setShowInfo(false);
            // show a quick marker via a temporary popup
            if (mapRef.current) {
              L.popup({ closeButton: true, maxWidth: 240 })
                .setLatLng([lat, lng])
                .setContent(`<div style="font-family:'Inter',system-ui,sans-serif;padding:10px 12px;"><div style="font-size:13px;font-weight:600;color:#1a2e1a;margin-bottom:4px;">${label}</div><div style="font-size:11px;color:#666;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div><div style="font-size:10px;color:#999;margin-top:2px;">Sumber: OpenStreetMap Nominatim</div></div>`)
                .openOn(mapRef.current);
            }
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* TOP RIGHT: Layer / school / stats panels */}
      {showLayerControl && !showSchoolList && !showStats && <LayerControlPanel layers={layers} onChange={setLayers} />}
      {showSchoolList && !showStats && <SchoolListPanel features={geoData} onSelect={handleSchoolSelect} onClose={() => setShowSchoolList(false)} />}
      {showStats && (
        <StatsPanel features={geoData} onSelectSchool={(f) => { const feat = f as GeoFeature; const center = getFeatureCenter(feat.geometry); if (center && mapRef.current) mapRef.current.flyTo(center, 17, { duration: 1.2 }); setSelectedFeature(feat); setSelectedLatlng(center ? { lat: center[0], lng: center[1] } : null); setShowInfo(true); setShowStats(false); }} onClose={() => setShowStats(false)} />
      )}

      {/* LEFT TOOLBAR */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
        {/* GPS */}
        <ToolBtn active={gpsActive} loading={gpsLoading} onClick={handleGPS} title={gpsActive ? "Nonaktifkan GPS" : "Aktifkan GPS"} testId="button-gps" color="blue">
          {gpsActive ? <LocateFixed className="w-4.5 h-4.5" /> : <Locate className="w-4.5 h-4.5" />}
        </ToolBtn>

        {/* Home */}
        <ToolBtn onClick={handleHome} title="Kembali ke pusat Ngawi" testId="button-home">
          <Home className="w-4 h-4" />
        </ToolBtn>

        {/* Fullscreen */}
        <ToolBtn active={isFullscreen} onClick={handleFullscreen} title={isFullscreen ? "Keluar layar penuh" : "Layar penuh"} testId="button-fullscreen">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </ToolBtn>

        <div className="h-px bg-white/40 w-8 mx-auto" />

        {/* Measure */}
        <ToolBtn active={measureMode} onClick={toggleMeasure} title={measureMode ? "Berhenti mengukur" : "Alat ukur jarak"} testId="button-measure" color="red">
          <Ruler className="w-4 h-4" />
        </ToolBtn>

        {/* Layer control */}
        <ToolBtn active={showLayerControl && !showSchoolList && !showStats} onClick={() => { setShowLayerControl((v) => { if (!v) { setShowSchoolList(false); setShowStats(false); } return !v; }); }} title="Kontrol lapisan" testId="button-layer-control">
          <Layers className="w-4 h-4" />
        </ToolBtn>

        {/* Legend */}
        <ToolBtn active={showLegend} onClick={() => setShowLegend((v) => !v)} title="Legenda peta" testId="button-legend">
          <BookOpen className="w-4 h-4" />
        </ToolBtn>

        <div className="h-px bg-white/40 w-8 mx-auto" />

        {/* School list */}
        <ToolBtn active={showSchoolList} onClick={() => { closeRightPanels(); setShowSchoolList((v) => !v); }} title="Daftar sekolah" testId="button-school-list" badge={schoolCount > 0 && !showSchoolList ? String(schoolCount) : undefined}>
          <GraduationCap className="w-4 h-4" />
        </ToolBtn>

        {/* Stats */}
        <ToolBtn active={showStats} onClick={() => { closeRightPanels(); setShowStats((v) => !v); }} title="Statistik kebutuhan sekolah" testId="button-stats" color="slate">
          <BarChart3 className="w-4 h-4" />
        </ToolBtn>

        <div className="h-px bg-white/40 w-8 mx-auto" />

        {/* Share */}
        <ToolBtn onClick={handleShare} title="Bagikan lokasi saat ini" testId="button-share">
          <Share2 className="w-4 h-4" />
        </ToolBtn>

        {/* Print */}
        <ToolBtn onClick={handlePrint} title="Cetak / ekspor peta" testId="button-print">
          <Printer className="w-4 h-4" />
        </ToolBtn>

        {/* About */}
        <ToolBtn onClick={() => setShowAbout(true)} title="Tentang aplikasi" testId="button-about">
          <HelpCircle className="w-4 h-4" />
        </ToolBtn>
      </div>

      {/* Basemap pill — bottom of left toolbar area */}
      <div className="absolute left-4 bottom-20 z-[1000]">
        <button
          onClick={() => setShowBasemap((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg border text-xs font-semibold transition-all ${showBasemap ? "bg-emerald-600 text-white border-emerald-500" : "bg-white/95 backdrop-blur-sm border-white/60 text-gray-600 hover:text-emerald-700"}`}
          title="Ganti basemap" data-testid="button-basemap"
        >
          <MapIcon className="w-3.5 h-3.5" />
          {TILE_LAYERS.find((t) => t.id === currentBasemap)?.label ?? "Basemap"}
        </button>
      </div>

      {/* Basemap selector */}
      {showBasemap && (
        <div className="absolute left-4 bottom-36 z-[1001] bg-white/97 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/60 overflow-hidden w-48" data-testid="basemap-panel">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Pilih Basemap</span>
            <button onClick={() => setShowBasemap(false)} data-testid="button-basemap-close"><X className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
          {TILE_LAYERS.map((t) => (
            <button key={t.id} onClick={() => setCurrentBasemap(t.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${currentBasemap === t.id ? "text-emerald-700 font-semibold bg-emerald-50/50" : "text-gray-700"}`} data-testid={`button-basemap-${t.id}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${currentBasemap === t.id ? "bg-emerald-600" : "bg-gray-200"}`} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Measure distance overlay */}
      {measureMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1002] mt-14">
          <div className="bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3">
            <Ruler className="w-4 h-4 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold">Mode Ukur Aktif — Klik peta untuk menambah titik</div>
              {measurePoints > 0 && (
                <div className="text-xs mt-0.5 text-red-200">
                  {measurePoints} titik · {formatDistance(measureDistance)}
                </div>
              )}
            </div>
            <button onClick={toggleMeasure} className="ml-2 bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 text-xs font-bold transition-colors">
              Selesai
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && <MapLegend onClose={() => setShowLegend(false)} />}

      {/* Info panel */}
      {showInfo && selectedFeature && selectedLatlng && (
        <InfoPanel feature={selectedFeature} latlng={selectedLatlng} onClose={() => setShowInfo(false)} />
      )}

      {/* About modal */}
      {showAbout && <AboutModal featureCount={featureCount.visible} onClose={() => setShowAbout(false)} />}

      {/* BOTTOM STATUS BAR */}
      <div className="absolute bottom-0 left-0 right-0 z-[999] flex items-center justify-between px-4 py-1.5 bg-white/80 backdrop-blur-sm border-t border-white/50 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-700">WebGIS Ngawi</span>
          <span className="text-gray-300">|</span>
          <span>{featureCount.visible} fitur · Sumber: OpenStreetMap</span>
        </div>
        <div className="flex items-center gap-3">
          {cursorCoords ? (
            <span className="font-mono text-[11px] text-gray-600">
              {cursorCoords.lat.toFixed(5)}°, {cursorCoords.lng.toFixed(5)}°
            </span>
          ) : (
            <span className="text-gray-400">Arahkan kursor ke peta</span>
          )}
          <span className="text-gray-300">|</span>
          <span>WGS84 · EPSG:4326</span>
        </div>
      </div>

      {/* Share toast */}
      {shareToast && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[9999] bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-xl shadow-xl flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5 text-emerald-400" />
          Link berhasil disalin ke clipboard!
        </div>
      )}

      {/* Hint (only when no panels) */}
      {!showInfo && !showSchoolList && !showStats && (
        <div className="absolute bottom-10 right-16 z-[999]">
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/60 shadow-sm">
            <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500">Klik fitur untuk info</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable toolbar button
function ToolBtn({
  children, onClick, active = false, loading = false, title, testId, color = "emerald", badge,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  loading?: boolean;
  title?: string;
  testId?: string;
  color?: "emerald" | "blue" | "red" | "slate";
  badge?: string;
}) {
  const activeColors = {
    emerald: "bg-emerald-600 border-emerald-500 text-white shadow-emerald-200",
    blue: "bg-blue-600 border-blue-500 text-white shadow-blue-200",
    red: "bg-red-500 border-red-400 text-white",
    slate: "bg-slate-700 border-slate-600 text-white",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      data-testid={testId}
      className={`relative w-10 h-10 rounded-xl shadow-lg border flex items-center justify-center transition-all ${
        active ? activeColors[color] : "bg-white/95 backdrop-blur-sm border-white/60 text-gray-600 hover:text-gray-900 hover:shadow-xl"
      } ${loading ? "animate-pulse" : ""}`}
    >
      {children}
      {badge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow">
          {badge}
        </span>
      )}
    </button>
  );
}
