import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';

// Coordenadas clave en Tafira [Longitud, Latitud]
const CARRIZAL = [-15.406939, 27.913489];
const puntosDeInteres = [
  { nombre: 'Las Canteras', coords: [-15.4363, 28.1389], pitch: 60, bearing: -30, zoom: 16.5 },
  { nombre: 'EII Tafira', coords: [-15.4533, 28.0708], pitch: 60, bearing: -15, zoom: 17 }
];

let indice = 0;

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: CARRIZAL,
  zoom: 16,
  pitch: 55,   // Inclinación
  bearing: -20, // Orientación
  maxPitch: 85
});

// Controles de navegación y escala métrica
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

map.on('load', () => {
  // Generar 2.000 puntos aleatorios alrededor de Gran Canaria
  const puntos = Array.from({ length: 20000 }, (_, i) => ({
    type: 'Feature',
    properties: { id: i, valor: Math.random() * 100 },
    geometry: {
      type: 'Point',
      coordinates: [
        -15.4533 + (Math.random() - 0.5) * 0.15,
        28.0708 + (Math.random() - 0.5) * 0.15
      ]
    }
  }));

  map.addSource('nube-puntos-geojson', {
    type: 'geojson',
    data: {type: 'FeatureCollection', features: puntos},
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 10
  });

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'nube-puntos-geojson',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#ff9800',
      'circle-radius': 18
    }
  });

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'nube-puntos-geojson',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-size': 12
    },
    paint: { 'text-color': '#ffffff' }
  });

  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'nube-puntos-geojson',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#00e5ff',
      'circle-radius': 5,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  });
});