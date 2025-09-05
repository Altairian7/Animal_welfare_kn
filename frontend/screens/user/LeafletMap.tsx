// LeafletMap.tsx - Separate component file
import React from 'react';
import { WebView } from 'react-native-webview';

interface LeafletMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  rescueCases: any[];
  radius: string;
  theme: any;
}

const LeafletMap: React.FC<LeafletMapProps> = ({
  userLocation,
  rescueCases,
  radius,
  theme,
}) => {
  const getRadiusMeters = (radiusStr: string) => {
    const num = parseFloat(radiusStr.split(' ')[0]);
    return num * 1000; // Convert km to meters
  };

  const centerLat = userLocation?.latitude || 28.6497956;
  const centerLng = userLocation?.longitude || 77.132018;
  const radiusMeters = getRadiusMeters(radius);

  const createMapHTML = () => {
    const markers = rescueCases
      .map((rescue) => {
        const lat = rescue.latitude;
        const lng = rescue.longitude;
        const severityColor = {
          'High': '#FF5252',
          'Critical': '#D32F2F',
          'Medium': '#FF9800',
          'Low': '#4CAF50'
        }[rescue.severity] || '#FFC107';

        return `
        L.marker([${lat}, ${lng}], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: ${severityColor}; width: 20px; height: 20px; border-radius: 10px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map).bindPopup('<b>${rescue.title}</b><br/>${rescue.species} - ${rescue.severity}<br/>Status: ${rescue.status}');
        `;
      })
      .join('');

    const userMarker = userLocation
      ? `
      L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
        icon: L.divIcon({
          className: 'user-marker',
          html: '<div style="background-color: ${theme.colors.primary}; width: 16px; height: 16px; border-radius: 8px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(map).bindPopup('<b>Your Location</b>');
      
      L.circle([${userLocation.latitude}, ${userLocation.longitude}], {
        color: '${theme.colors.primary}',
        fillColor: '${theme.colors.primary}',
        fillOpacity: 0.1,
        radius: ${radiusMeters}
      }).addTo(map);
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rescue Map</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { width: 100%; height: 250px; }
          .custom-marker, .user-marker { background: transparent; border: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${centerLat}, ${centerLng}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          
          ${userMarker}
          ${markers}
          
          // Auto-fit bounds if we have markers
          ${rescueCases.length > 0 ? `
          var group = new L.featureGroup([]);
          map.eachLayer(function(layer) {
            if (layer instanceof L.Marker) {
              group.addLayer(layer);
            }
          });
          if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds().pad(0.1));
          }
          ` : ''}
        </script>
      </body>
      </html>
    `;
  };

  return (
    <WebView
      source={{ html: createMapHTML() }}
      style={{ width: '100%', height: 250 }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={true}
      scalesPageToFit={true}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    />
  );
};

export default LeafletMap;
