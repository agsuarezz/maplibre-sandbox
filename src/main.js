import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
import { createTriangleLayer } from './triangleLayer.js';
import { createPointCloudLayer } from './pointCloudLayer.js';

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
  maxPitch: 85,

  maxTileCacheSize: 100,
  fadeDuration: 0
});

// Controles de navegación y escala métrica
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

map.on('load', () => {

  map.addSource('terrain-source', {
    type: 'raster-dem',
    tiles: [
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
    ],
    encoding: 'terrarium', // Obligatorio: indica a MapLibre la fórmula de decodificación RGB
    tileSize: 256,
    maxzoom: 12
  });

// 2. Activación del terreno 3D
  map.setTerrain({
    source: 'terrain-source',
    exaggeration: 1.5 // Factor de multiplicación del relieve
  });

  const nubeLayer = createPointCloudLayer('nube-50k-tafira', CARRIZAL, 320);
  map.addLayer(nubeLayer);
});

// Exponer las instancias al objeto global para depuración en consola
window.maplibregl = maplibregl;
window.map = map;