import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import toast from 'react-hot-toast';

import { getAirports, getEarthquakes, getLandmarks } from '../../api/gazetteerApi';
import { useAppStore } from '../../store/appStore';
import type { Airport, EarthquakeFeature, PlaceSuggestion } from '../../types/app';
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

export function GazetteerMap() {
  const { selectedPlace, mapMode, overlays } = useAppStore();
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

  useEffect(() => {
    if (airportsError) toast.error('Airports could not be loaded.');
    if (quakesError) toast.error('Earthquake feed could not be loaded.');
    if (landmarksError) toast.error('Landmarks could not be loaded.');
  }, [airportsError, landmarksError, quakesError]);

  const visibleAirports = useMemo(() => filterAirports(airports, selectedPlace), [airports, selectedPlace]);
  const visibleQuakes = useMemo(() => filterEarthquakes(earthquakes, selectedPlace), [earthquakes, selectedPlace]);

  const tileLayer =
    mapMode === 'satellite'
      ? {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution:
            'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        }
      : {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        };

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
    </MapContainer>
  );
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
