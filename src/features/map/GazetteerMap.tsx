import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import toast from 'react-hot-toast';

import { getAirports, getDisasters, getEarthquakes, getLandmarks } from '../../api/gazetteerApi';
import { useAppStore } from '../../store/appStore';
import type { Airport, DisasterEvent, DrawingFeature, EarthquakeFeature, PlaceSuggestion } from '../../types/app';
import { haversineKm } from '../../utils/geo';

const defaultCenter: [number, number] = [20, 0];

const selectedIcon = L.divIcon({
  className: 'selected-place-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const landmarkIcon = L.divIcon({
  className: 'landmark-marker',
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const nearbyIcon = L.divIcon({
  className: 'nearby-marker',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const drawingIcon = L.divIcon({
  className: 'drawing-marker',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const disasterColors: Record<DisasterEvent['category'], string> = {
  wildfires: '#ef4444',
  volcanoes: '#a855f7',
  storms: '#2563eb',
  floods: '#0891b2',
};

export function GazetteerMap() {
  const { selectedPlace, mapMode, overlays, nearbyPlaces, route, drawings, drawingDraft } = useAppStore();
  const { data: airports = [], isError: airportsError } = useQuery({
    queryKey: ['airports'],
    queryFn: getAirports,
    enabled: overlays.airports,
    staleTime: 1000 * 60 * 60 * 24,
  });
  const { data: earthquakes = [], isError: quakesError } = useQuery({
    queryKey: ['earthquakes'],
    queryFn: getEarthquakes,
    enabled: overlays.earthquakes,
    refetchInterval: 1000 * 60 * 5,
  });
  const { data: landmarks = [], isError: landmarksError } = useQuery({
    queryKey: ['landmarks', selectedPlace?.geonameId, selectedPlace?.countryCode],
    queryFn: () => getLandmarks(selectedPlace!),
    enabled: overlays.landmarks && Boolean(selectedPlace),
  });
  const wildfires = useDisasterLayer('wildfires', overlays.wildfires);
  const volcanoes = useDisasterLayer('volcanoes', overlays.volcanoes);
  const storms = useDisasterLayer('storms', overlays.storms);
  const floods = useDisasterLayer('floods', overlays.floods);

  useEffect(() => {
    if (airportsError) toast.error('Airports could not be loaded.');
    if (quakesError) toast.error('Earthquake feed could not be loaded.');
    if (landmarksError) toast.error('Landmarks could not be loaded.');
  }, [airportsError, landmarksError, quakesError]);

  const visibleAirports = useMemo(() => filterAirports(airports, selectedPlace), [airports, selectedPlace]);
  const visibleQuakes = useMemo(() => filterEarthquakes(earthquakes, selectedPlace), [earthquakes, selectedPlace]);

  const tileLayer = tileLayers[mapMode];
  const disasterEvents = [wildfires.data, volcanoes.data, storms.data, floods.data].flatMap((items) => items ?? []);

  return (
    <MapContainer
      center={defaultCenter}
      className="h-full w-full"
      maxBounds={[
        [-60, -180],
        [85, 180],
      ]}
      maxBoundsViscosity={1}
      maxZoom={18}
      minZoom={3}
      scrollWheelZoom
      zoom={3}
    >
      <TileLayer
        attribution={tileLayer.attribution}
        url={tileLayer.url}
      />
      <MapFocus place={selectedPlace} />
      <DrawingEvents />
      {selectedPlace ? (
        <Marker icon={selectedIcon} position={[selectedPlace.lat, selectedPlace.lng]}>
          <Tooltip direction="top">{selectedPlace.name}</Tooltip>
        </Marker>
      ) : null}
      {overlays.airports
        ? visibleAirports.map((airport) => (
            <CircleMarker
              center={[airport.lat, airport.lng]}
              fillColor="#0f8b8d"
              fillOpacity={0.85}
              key={airport.id}
              pathOptions={{ color: '#095f61', weight: 1 }}
              radius={5}
            >
              <Tooltip direction="top">
                {airport.name} {airport.iata ? `(${airport.iata})` : ''}
              </Tooltip>
            </CircleMarker>
          ))
        : null}
      {overlays.earthquakes
        ? visibleQuakes.map((quake) => {
            const coords = quake.geometry.coordinates;
            const magnitude = quake.properties.mag ?? 0;
            const color = magnitude >= 5 ? '#d62828' : magnitude >= 3 ? '#f4a261' : '#2a9d8f';
            return (
              <CircleMarker
                center={[coords[1], coords[0]]}
                fillColor={color}
                fillOpacity={0.82}
                key={`${quake.properties.time}-${quake.properties.place}`}
                pathOptions={{ color, weight: 1 }}
                radius={Math.max(3, 2 + magnitude * 2)}
              >
                <Tooltip direction="top">
                  M{magnitude.toFixed(1)} - {quake.properties.place}
                </Tooltip>
              </CircleMarker>
            );
          })
        : null}
      {overlays.landmarks
        ? landmarks.map((landmark) => (
            <Marker icon={landmarkIcon} key={`${landmark.title}-${landmark.lat}`} position={[landmark.lat, landmark.lng]}>
              <Tooltip direction="top">{landmark.title}</Tooltip>
              <Popup>
                <strong>{landmark.title}</strong>
                <p>{landmark.summary || 'No summary available.'}</p>
                {landmark.wikipediaUrl ? (
                  <a href={`https://${landmark.wikipediaUrl}`} rel="noreferrer" target="_blank">
                    View on Wikipedia
                  </a>
                ) : null}
              </Popup>
            </Marker>
          ))
        : null}
      {nearbyPlaces.map((place) => (
        <Marker icon={nearbyIcon} key={place.id} position={[place.lat, place.lng]}>
          <Tooltip direction="top">
            {place.name} - {place.distanceKm} km
          </Tooltip>
          <Popup>
            <strong>{place.name}</strong>
            <p>
              {place.category} · {place.distanceKm} km away
            </p>
          </Popup>
        </Marker>
      ))}
      {disasterEvents.map((event) => (
        <CircleMarker
          center={[event.lat, event.lng]}
          fillColor={disasterColors[event.category]}
          fillOpacity={0.78}
          key={`${event.category}-${event.id}-${event.lat}`}
          pathOptions={{ color: disasterColors[event.category], weight: 2 }}
          radius={7}
        >
          <Tooltip direction="top">{event.title}</Tooltip>
          <Popup>
            <strong>{event.title}</strong>
            <p>
              {event.category} · {event.date ? new Date(event.date).toLocaleDateString() : 'Active event'}
            </p>
            <p>Source: {event.source}</p>
          </Popup>
        </CircleMarker>
      ))}
      {drawings.map((drawing) => (
        <DrawingOverlay drawing={drawing} key={drawing.id} />
      ))}
      {drawingDraft.length ? (
        <Polyline pathOptions={{ color: '#0f8b8d', dashArray: '6 6', weight: 3 }} positions={drawingDraft} />
      ) : null}
      {route ? (
        <Polyline
          pathOptions={{ color: '#e76f51', weight: 5, opacity: 0.88 }}
          positions={route.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
        />
      ) : null}
    </MapContainer>
  );
}

const tileLayers = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
  },
};

function useDisasterLayer(category: DisasterEvent['category'], enabled: boolean) {
  return useQuery({
    queryKey: ['disasters', category],
    queryFn: () => getDisasters(category),
    enabled,
    staleTime: 1000 * 60 * 20,
  });
}

function DrawingEvents() {
  const { drawingMode, drawingDraft, setDrawingDraft, addDrawing } = useAppStore();

  useMapEvents({
    click(event) {
      if (drawingMode === 'select') return;
      const point: [number, number] = [event.latlng.lat, event.latlng.lng];

      if (drawingMode === 'marker') {
        addDrawing(makeDrawing('marker', [point]));
        return;
      }

      if (drawingMode === 'circle' && drawingDraft.length === 1) {
        const radiusKm = haversineKm(drawingDraft[0][0], drawingDraft[0][1], point[0], point[1]);
        addDrawing(makeDrawing('circle', [drawingDraft[0], point], { radiusKm }));
        return;
      }

      if (drawingMode === 'rectangle' && drawingDraft.length === 1) {
        const areaKm2 = rectangleAreaKm2(drawingDraft[0], point);
        addDrawing(makeDrawing('rectangle', [drawingDraft[0], point], { areaKm2 }));
        return;
      }

      if (drawingMode === 'distance' && drawingDraft.length === 1) {
        const distanceKm = haversineKm(drawingDraft[0][0], drawingDraft[0][1], point[0], point[1]);
        addDrawing(makeDrawing('distance', [drawingDraft[0], point], { distanceKm }));
        return;
      }

      setDrawingDraft([...drawingDraft, point]);
    },
  });

  return null;
}

function DrawingOverlay({ drawing }: { drawing: DrawingFeature }) {
  const removeDrawing = useAppStore((state) => state.removeDrawing);
  const popup = (
    <Popup>
      <strong>{drawing.label}</strong>
      {drawing.distanceKm ? <p>Distance: {drawing.distanceKm.toFixed(2)} km</p> : null}
      {drawing.radiusKm ? <p>Radius: {drawing.radiusKm.toFixed(2)} km</p> : null}
      {drawing.areaKm2 ? <p>Area: {drawing.areaKm2.toFixed(2)} km2</p> : null}
      <button className="text-coral" onClick={() => removeDrawing(drawing.id)} type="button">
        Remove
      </button>
    </Popup>
  );

  if (drawing.kind === 'marker') {
    return (
      <Marker icon={drawingIcon} position={drawing.points[0]}>
        {popup}
      </Marker>
    );
  }
  if (drawing.kind === 'circle') {
    return (
      <Circle center={drawing.points[0]} pathOptions={{ color: '#0f8b8d' }} radius={(drawing.radiusKm ?? 0) * 1000}>
        {popup}
      </Circle>
    );
  }
  if (drawing.kind === 'rectangle') {
    return (
      <Rectangle bounds={[drawing.points[0], drawing.points[1]]} pathOptions={{ color: '#e76f51' }}>
        {popup}
      </Rectangle>
    );
  }
  if (drawing.kind === 'polygon') {
    return (
      <Polygon pathOptions={{ color: '#0f8b8d' }} positions={drawing.points}>
        {popup}
      </Polygon>
    );
  }
  return (
    <Polyline pathOptions={{ color: '#e76f51', weight: 4 }} positions={drawing.points}>
      {popup}
    </Polyline>
  );
}

function makeDrawing(
  kind: DrawingFeature['kind'],
  points: Array<[number, number]>,
  measurements: Partial<Pick<DrawingFeature, 'radiusKm' | 'distanceKm' | 'areaKm2'>> = {},
): DrawingFeature {
  return {
    id: crypto.randomUUID(),
    kind,
    label: humanDrawingLabel(kind),
    points,
    createdAt: Date.now(),
    ...measurements,
  };
}

function humanDrawingLabel(kind: DrawingFeature['kind']) {
  return kind.replace(/^\w/, (letter) => letter.toUpperCase());
}

function rectangleAreaKm2(a: [number, number], b: [number, number]) {
  const width = haversineKm(a[0], a[1], a[0], b[1]);
  const height = haversineKm(a[0], a[1], b[0], a[1]);
  return width * height;
}

function MapFocus({ place }: { place: PlaceSuggestion | null }) {
  const map = useMap();

  useEffect(() => {
    if (place) {
      map.setView([place.lat, place.lng], place.fcode === 'PCLI' ? 5 : 7, { animate: true });
      return;
    }
    map.setView(defaultCenter, 3, { animate: true });
  }, [map, place]);

  return null;
}

function filterAirports(airports: Airport[], place: PlaceSuggestion | null) {
  if (!place) return [];

  return airports
    .filter((airport) => {
      if (place.fcode === 'PCLI') return airport.isoCountry === place.countryCode;
      return haversineKm(place.lat, place.lng, airport.lat, airport.lng) <= 100;
    })
    .slice(0, 600);
}

function filterEarthquakes(earthquakes: EarthquakeFeature[], place: PlaceSuggestion | null) {
  if (!place) return earthquakes.slice(0, 250);
  if (place.fcode === 'PCLI') return earthquakes.slice(0, 250);

  return earthquakes
    .filter((quake) => {
      const [lng, lat] = quake.geometry.coordinates;
      return haversineKm(place.lat, place.lng, lat, lng) <= 1000;
    })
    .slice(0, 250);
}
