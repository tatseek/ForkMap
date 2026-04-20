/**
 * map.js  –  Leaflet map manager
 *
 * Responsibilities:
 *  • Initialise Leaflet with OpenStreetMap tiles
 *  • Manage user location marker
 *  • Plot restaurant markers with custom icons & popups
 *  • Draw Dijkstra route polylines
 *  • Fit bounds to results
 */

const MapManager = (() => {

    let map           = null;
    let userMarker    = null;
    let restaurantLayers = [];  // L.Marker[]
    let routeLayer    = null;   // L.Polyline
    let graphLayer    = null;   // L.LayerGroup (debug graph nodes)

    // ── Price helper ──────────────────────────────────────────
    const priceLabel = n => '$'.repeat(n);

    // ── Star helper ───────────────────────────────────────────
    const stars = r => {
        const full  = Math.floor(r);
        const half  = r - full >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
    };

    // ── Custom DivIcon factory ────────────────────────────────
    function makeRestaurantIcon(emoji, score) {
        const hue = Math.round(score * 120);   // green shades for high scorers
        return L.divIcon({
            className: '',
            html: `
                <div class="map-pin" style="--pin-hue:${hue}">
                    <span class="pin-emoji">${emoji}</span>
                </div>`,
            iconSize:   [42, 52],
            iconAnchor: [21, 52],
            popupAnchor:[0, -54],
        });
    }

    function makeUserIcon() {
        return L.divIcon({
            className: '',
            html: `<div class="map-pin map-pin--user"><span class="pin-emoji">📍</span></div>`,
            iconSize:   [42, 52],
            iconAnchor: [21, 52],
        });
    }

    // ── Init ─────────────────────────────────────────────────
    function init(elementId, lat = 40.7549, lng = -73.9840, zoom = 14) {
        if (map) { map.remove(); }

        map = L.map(elementId, {
            zoomControl: true,
            attributionControl: true,
        }).setView([lat, lng], zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        return map;
    }

    // ── User marker ───────────────────────────────────────────
    function setUserLocation(lat, lng) {
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([lat, lng], { icon: makeUserIcon(), zIndexOffset: 1000 })
            .addTo(map)
            .bindPopup('<b>You are here</b>');

        // Accuracy circle
        L.circle([lat, lng], { radius: 80, color: '#4f8ef7', fillOpacity: 0.08 }).addTo(map);
    }

    // ── Restaurant markers ────────────────────────────────────
    function plotRestaurants(restaurants, onSelect) {
        clearRestaurants();

        if (!restaurants.length) return;

        const bounds = L.latLngBounds();

        restaurants.forEach(r => {
            const icon   = makeRestaurantIcon(r.cuisine_emoji, r.rank_score ?? 0);
            const marker = L.marker([r.latitude, r.longitude], { icon })
                .addTo(map)
                .bindPopup(buildPopupHTML(r));

            marker.on('click', () => onSelect && onSelect(r));

            restaurantLayers.push(marker);
            bounds.extend([r.latitude, r.longitude]);
        });

        if (userMarker) bounds.extend(userMarker.getLatLng());
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }

    function buildPopupHTML(r) {
        return `
        <div class="map-popup">
            <h3>${r.cuisine_emoji} ${r.name}</h3>
            <p class="popup-meta">
                <span class="stars">${stars(parseFloat(r.rating))}</span>
                <span>${r.rating} (${r.review_count} reviews)</span>
            </p>
            <p class="popup-meta">
                ${priceLabel(r.price_range)} &bull;
                ${r.cuisine_name} &bull;
                ${parseFloat(r.distance_km).toFixed(2)} km
            </p>
            <p class="popup-addr">${r.address}</p>
            <button class="btn-route"
                    onclick="window.App && window.App.routeTo(${r.id})">
                🗺️ Get Route
            </button>
        </div>`;
    }

    function clearRestaurants() {
        restaurantLayers.forEach(m => map.removeLayer(m));
        restaurantLayers = [];
    }

    // ── Route polyline ────────────────────────────────────────
    function drawRoute(pathGeo) {
        if (routeLayer) map.removeLayer(routeLayer);

        if (!pathGeo || !pathGeo.length) return;

        const latlngs = pathGeo.map(n => [n.latitude, n.longitude]);

        routeLayer = L.polyline(latlngs, {
            color:     '#e84c3d',
            weight:    5,
            opacity:   0.85,
            dashArray: null,
            lineJoin:  'round',
        }).addTo(map);

        // Animated dots along route
        pathGeo.forEach((node, i) => {
            if (i === 0 || i === pathGeo.length - 1) return;
            L.circleMarker([node.latitude, node.longitude], {
                radius: 4, color: '#e84c3d', fillColor: '#fff', fillOpacity: 1, weight: 2,
            }).addTo(map).bindTooltip(node.label, { permanent: false });
        });

        map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    }

    function clearRoute() {
        if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    }

    // ── Graph overlay (debug) ─────────────────────────────────
    function drawGraph(nodes) {
        if (graphLayer) map.removeLayer(graphLayer);
        graphLayer = L.layerGroup();
        nodes.forEach(n => {
            L.circleMarker([n.latitude, n.longitude], {
                radius: 5, color: '#8b5cf6', fillOpacity: 0.6, weight: 1,
            }).bindTooltip(`Node ${n.id}: ${n.label}`, { permanent: false })
              .addTo(graphLayer);
        });
        graphLayer.addTo(map);
    }

    // ── Highlight a single restaurant marker ──────────────────
    function highlightMarker(restaurantId) {
        // open popup for matching marker (simple approach)
        restaurantLayers.forEach(m => {
            if (m._restaurantId === restaurantId) m.openPopup();
        });
    }

    return {
        init,
        setUserLocation,
        plotRestaurants,
        clearRestaurants,
        drawRoute,
        clearRoute,
        drawGraph,
        highlightMarker,
        getMap: () => map,
    };
})();

export default MapManager;
