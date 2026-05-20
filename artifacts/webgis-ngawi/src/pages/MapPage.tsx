import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import LoadingScreen from "@/components/LoadingScreen";
import SearchPanel from "@/components/SearchPanel";
import InfoPanel from "@/components/InfoPanel";
import LayerControlPanel, { LayerState } from "@/components/LayerControlPanel";
import {
  Search,
  Locate,
  LocateFixed,
  Map as MapIcon,
  Info,
  X,
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

function makePopupContent(props: GeoFeature["properties"]): string {
  const amenityMap: Record<string, string> = {
    school: "🏫 Sekolah",
    university: "🏛️ Universitas",
  };
  const name = props.name || "Fitur Tanpa Nama";
  const amenity = props.amenity ? amenityMap[props.amenity] || props.amenity : null;
  const operatorRow = props.operator
    ? `<div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#999;">Pengelola</span><span style="text-align:right;font-weight:500;">${props.operator}</span></div>`
    : "";
  const idRow = props.osm_id
    ? `<div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#999;">OSM ID</span><span style="font-family:monospace;font-size:11px;">${props.osm_id}</span></div>`
    : "";
  return `
    <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:200px;max-width:260px;">
      <div style="padding:12px 14px 10px;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:600;color:#1a2e1a;line-height:1.3;margin-bottom:4px;">${name}</div>
        ${amenity ? `<span style="display:inline-block;font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:#e8f5e9;color:#2e7d32;">${amenity}</span>` : ""}
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
    const dataUrl = BASE_URL.endsWith("/")
      ? `${BASE_URL}data/ngawi.geojson`
      : `${BASE_URL}/data/ngawi.geojson`;
    try {
      const res = await fetch(dataUrl);
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

    const schoolIcon = L.divIcon({
      className: "",
      html: `<div style="width:30px;height:30px;background:#3b82f6;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;">
        <div style="transform:rotate(45deg);font-size:13px;line-height:24px;text-align:center;">🏫</div>
      </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -34],
    });

    const uniIcon = L.divIcon({
      className: "",
      html: `<div style="width:34px;height:34px;background:#8b5cf6;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 10px rgba(139,92,246,0.5);display:flex;align-items:center;justify-content:center;">
        <div style="transform:rotate(45deg);font-size:15px;line-height:28px;text-align:center;">🏛️</div>
      </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -38],
    });

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
      };

      if (geom.type === "Point") {
        const coords = geom.coordinates as number[];
        const latlng: [number, number] = [coords[1], coords[0]];
        let group = groups.points;
        let icon = pointIcon;
        if (props.amenity === "school") {
          group = groups.schools;
          icon = schoolIcon;
        } else if (props.amenity === "university") {
          group = groups.universities;
          icon = uniIcon;
        }
        const marker = L.marker(latlng, { icon });
        marker.bindPopup(popupContent, { maxWidth: 280, minWidth: 220 });
        marker.on("click", (e) => handleClick(e.latlng));
        marker.addTo(group);
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
      if (active) {
        if (!map.hasLayer(group)) map.addLayer(group);
      } else {
        if (map.hasLayer(group)) map.removeLayer(group);
      }
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
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const tile = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      maxZoom: 19,
    });
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

        const circle = L.circle([lat, lng], {
          radius: accuracy,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          weight: 1,
        });
        circle.addTo(map);
        gpsCircleRef.current = circle;

        const gpsIcon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:18px;height:18px;">
            <div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6);"></div>
          </div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker([lat, lng], { icon: gpsIcon });
        marker.bindPopup(
          `<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:12px;text-align:center;">
            <div style="font-size:13px;font-weight:600;color:#1a2e1a;margin-bottom:6px;">Lokasi Anda</div>
            <div style="font-size:11px;color:#666;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
            <div style="font-size:11px;color:#999;margin-top:2px;">Akurasi: ±${Math.round(accuracy)}m</div>
          </div>`
        );
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

      {/* Layer control */}
      <LayerControlPanel layers={layers} onChange={setLayers} />

      {/* GPS + Basemap controls */}
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
          {gpsActive ? (
            <LocateFixed className="w-5 h-5" />
          ) : (
            <Locate className="w-5 h-5" />
          )}
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
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  currentBasemap === t.id ? "bg-emerald-600" : "bg-gray-200"
                }`}
              />
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
    </div>
  );
}
