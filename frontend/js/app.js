/**
 * app.js  –  Main application controller
 *
 * Ties together: Api, MapManager, UI rendering
 */

import Api        from './api.js';
import MapManager from './map.js';

// ── State ─────────────────────────────────────────────────────
const state = {
    userLat:     40.7549,
    userLng:    -73.9840,
    radius:      2.0,
    cuisine:     '',
    restaurants: [],
    loading:     false,
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const els = {};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    MapManager.init('map', state.userLat, state.userLng);
    MapManager.setUserLocation(state.userLat, state.userLng);
    await loadCuisines();
    bindEvents();
    await search();
});

function cacheElements() {
    els.searchBtn    = $('searchBtn');
    els.locateBtn    = $('locateBtn');
    els.radiusInput  = $('radiusInput');
    els.radiusLabel  = $('radiusLabel');
    els.cuisineSelect= $('cuisineSelect');
    els.resultsList  = $('resultsList');
    els.resultsCount = $('resultsCount');
    els.loadingOverlay=$('loadingOverlay');
    els.routeInfo    = $('routeInfo');
    els.clearRoute   = $('clearRouteBtn');
    els.graphToggle  = $('graphToggle');
    els.toastContainer=$('toastContainer');
    els.locationInput = $('locationInput');
    els.locationSearchBtn = $('locationSearchBtn');
    els.routingMode  = $('routingMode'); 
}

// ── Cuisine filter ────────────────────────────────────────────
async function loadCuisines() {
    try {
        const { cuisines } = await Api.getCuisines();
        const frag = document.createDocumentFragment();
        const opt0 = document.createElement('option');
        opt0.value = ''; opt0.textContent = 'All Cuisines';
        frag.appendChild(opt0);
        cuisines.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = `${c.emoji} ${c.name}`;
            frag.appendChild(opt);
        });
        els.cuisineSelect.appendChild(frag);
    } catch { /* non-fatal */ }
}

// ── Event bindings ────────────────────────────────────────────
function bindEvents() {
    els.searchBtn.addEventListener('click', search);

    els.radiusInput.addEventListener('input', () => {
        state.radius = parseFloat(els.radiusInput.value);
        els.radiusLabel.textContent = state.radius.toFixed(1) + ' km';
    });

    els.cuisineSelect.addEventListener('change', () => {
        state.cuisine = els.cuisineSelect.value;
        search();
    });

    els.locateBtn.addEventListener('click', locateUser);

    els.clearRoute.addEventListener('click', () => {
        MapManager.clearRoute();
        els.routeInfo.classList.add('hidden');
    });

    els.graphToggle.addEventListener('change', async (e) => {
        if (e.target.checked) {
            try {
                const g = await Api.getGraph();
                MapManager.drawGraph(g.nodes);
            } catch { toast('Failed to load graph overlay', 'error'); }
        } else {
            MapManager.drawGraph([]);
        }
    });

    // Allow pressing Enter in any filter input
    document.querySelectorAll('.search-input').forEach(el => {
        el.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
    });
    els.locationSearchBtn.addEventListener('click', () => {
    const query = els.locationInput.value.trim();
    if (query) searchLocation(query);
});

els.locationInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const query = els.locationInput.value.trim();
        if (query) searchLocation(query);
    }
});
}

// ── Geolocation ───────────────────────────────────────────────
function locateUser() {
    if (!navigator.geolocation) {
        return toast('Geolocation not supported by your browser.', 'error');
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
        pos => {
            state.userLat = pos.coords.latitude;
            state.userLng = pos.coords.longitude;
            MapManager.setUserLocation(state.userLat, state.userLng);
            setLoading(false);
            search();
        },
        err => {
            setLoading(false);
            toast('Could not get your location: ' + err.message, 'error');
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}
// ── Location Search (Nominatim) ───────────────────────────────
async function searchLocation(query) {
    const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data.length === 0) return toast('Location not found', 'error');

    const { lat, lon } = data[0];
    state.userLat = parseFloat(lat);
    state.userLng = parseFloat(lon);

    MapManager.getMap().setView([state.userLat, state.userLng], 14);
    MapManager.setUserLocation(state.userLat, state.userLng);
    await search();
}


// ── Main search ───────────────────────────────────────────────
async function search() {
    if (state.loading) return;
    setLoading(true);
    clearResults();

    try {
        const data = await Api.searchRestaurants(
            state.userLat, state.userLng,
            { radius: state.radius, cuisine: state.cuisine, limit: 20 }
        );
        state.restaurants = data.results;
        renderResults(data.results);
        MapManager.plotRestaurants(data.results, onRestaurantSelect);
        els.resultsCount.textContent =
            `${data.count} restaurant${data.count !== 1 ? 's' : ''} found`;
    } catch (err) {
        toast('Search failed: ' + err.message, 'error');
        els.resultsCount.textContent = '0 restaurants found';
    } finally {
        setLoading(false);
    }
}

// ── Result cards ─────────────────────────────────────────────
function renderResults(restaurants) {
    const frag = document.createDocumentFragment();
    restaurants.forEach((r, idx) => {
        frag.appendChild(buildCard(r, idx));
    });
    els.resultsList.appendChild(frag);
}

function buildCard(r, idx) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.setAttribute('data-id', r.id);
    card.style.animationDelay = `${idx * 60}ms`;

    const score   = (r.rank_score * 100).toFixed(0);
    const distStr = parseFloat(r.distance_km).toFixed(2);
    const price   = '$'.repeat(r.price_range);
    const starsHtml = starHtml(parseFloat(r.rating));

    card.innerHTML = `
        <div class="card-header">
            <span class="card-emoji">${r.cuisine_emoji}</span>
            <div class="card-title-block">
                <h3 class="card-name">${escHtml(r.name)}</h3>
                <span class="card-cuisine">${escHtml(r.cuisine_name)}</span>
            </div>
            <span class="card-score" title="Rank score">${score}</span>
        </div>
        <div class="card-body">
            <div class="card-rating">
                ${starsHtml}
                <span class="rating-num">${r.rating}</span>
                <span class="review-count">(${Number(r.review_count).toLocaleString()})</span>
            </div>
            <div class="card-meta">
                <span class="price">${price}</span>
                <span class="dot">·</span>
                <span class="dist">${distStr} km</span>
            </div>
            <p class="card-addr">${escHtml(r.address)}</p>
        </div>
        <div class="card-actions">
            <button class="btn btn-route" data-id="${r.id}">🗺️ Route</button>
            <button class="btn btn-focus" data-id="${r.id}">📌 Focus</button>
        </div>`;

    card.querySelector('.btn-route').addEventListener('click', e => {
        e.stopPropagation();
        routeTo(r.id);
    });
    card.querySelector('.btn-focus').addEventListener('click', e => {
        e.stopPropagation();
        MapManager.highlightMarker(r.id);
    });
    card.addEventListener('click', () => onRestaurantSelect(r));

    return card;
}

function clearResults() {
    els.resultsList.innerHTML = '';
}

// ── Restaurant selected ───────────────────────────────────────
function onRestaurantSelect(r) {
    document.querySelectorAll('.result-card').forEach(c => {
        c.classList.toggle('active', +c.dataset.id === r.id);
    });
}

// ── Routing (Dijkstra) ────────────────────────────────────────
// ── Routing (Hybrid: OSRM + Dijkstra) ─────────────────────────
async function routeTo(restaurantId) {
    const rest = state.restaurants.find(r => r.id == restaurantId);
    if (!rest) return toast('Restaurant not found', 'error');
    setLoading(true);
    MapManager.clearRoute();
    els.routeInfo.classList.add('hidden');

    const useDijkstra = els.routingMode && els.routingMode.value === 'dijkstra';

    try {
        if (useDijkstra) {
            try {
                await routeViaDijkstra(restaurantId, rest);
            } catch (e) {
                // Dijkstra failed — silently fall back to OSRM
                toast('Dijkstra unavailable for this location, using OSRM route', 'info');
                await routeViaOSRM(rest);
            }
        } else {
            await routeViaOSRM(rest);
        }
    } catch (err) {
        toast('Routing failed: ' + err.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Custom Dijkstra (uses our backend + graph_nodes)
async function routeViaDijkstra(restaurantId, rest) {
    // Generate graph dynamically around user + destination
    const graph = generateLocalGraph(
        state.userLat, state.userLng,
        parseFloat(rest.latitude), parseFloat(rest.longitude)
    );

    const result = dijkstraLocal(
        graph.adjacency,
        graph.sourceNode.id,
        graph.destNode.id
    );

    if (!result || result.distance === Infinity) {
        throw new Error('No path found');
    }

    // Convert path node ids to lat/lng for map rendering
    const nodeById = {};
    Object.values(graph.nodes).forEach(n => nodeById[n.id] = n);

    const pathGeo = result.path.map(id => ({
        latitude:  nodeById[id].lat,
        longitude: nodeById[id].lng,
        label: `Node ${id}`
    }));

    const distKm = (result.distance / 1000).toFixed(2);

    MapManager.drawRoute(pathGeo);
    els.routeInfo.innerHTML = `
        <strong>Dijkstra Route to ${rest.name}</strong><br>
        Distance: <b>${distKm} km</b> (${Math.round(result.distance)} m)<br>
        Nodes visited: ${result.path.length}`;
    els.routeInfo.classList.remove('hidden');
    toast(`Dijkstra route found: ${distKm} km`, 'success');
}
// OSRM (works worldwide)
async function routeViaOSRM(rest) {
    const url = `https://router.project-osrm.org/route/v1/driving/` +
                `${state.userLng},${state.userLat};${rest.longitude},${rest.latitude}` +
                `?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found via OSRM');
    }

    const route = data.routes[0];
    const path = route.geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
        label: ''
    }));

    MapManager.drawRoute(path);

    const distanceKm = (route.distance / 1000).toFixed(2);
    const durationMin = Math.round(route.duration / 60);

    els.routeInfo.innerHTML = `
        <strong>Route to ${rest.name}</strong><br>
        <span class="route-mode">via OSRM (OpenStreetMap)</span><br>
        Distance: <b>${distanceKm} km</b><br>
        Duration: <b>${durationMin} min</b> by car`;
    els.routeInfo.classList.remove('hidden');
    toast(`Route found: ${distanceKm} km (OSRM)`, 'success');
}

// ── Utilities ─────────────────────────────────────────────────
function setLoading(on) {
    state.loading = on;
    els.loadingOverlay.classList.toggle('hidden', !on);
}

function starHtml(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating))      html += '<span class="star full">★</span>';
        else if (i - rating < 1)          html += '<span class="star half">★</span>';
        else                              html += '<span class="star empty">☆</span>';
    }
    return html;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}

function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    els.toastContainer.appendChild(t);
    setTimeout(() => t.classList.add('toast--visible'), 10);
    setTimeout(() => {
        t.classList.remove('toast--visible');
        setTimeout(() => t.remove(), 400);
    }, 3500);
}
function generateLocalGraph(userLat, userLng, destLat, destLng) {
    const nodes = {};
    const adjacency = {};

    // Create a 5x5 grid of nodes spanning between user and destination
    const minLat = Math.min(userLat, destLat) - 0.005;
    const maxLat = Math.max(userLat, destLat) + 0.005;
    const minLng = Math.min(userLng, destLng) - 0.005;
    const maxLng = Math.max(userLng, destLng) + 0.005;

    const GRID = 5;
    let id = 1;

    for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
            const lat = minLat + (i / (GRID - 1)) * (maxLat - minLat);
            const lng = minLng + (j / (GRID - 1)) * (maxLng - minLng);
            nodes[`${i}_${j}`] = { id, lat, lng };
            adjacency[id] = [];
            id++;
        }
    }

    // Connect adjacent nodes with Haversine distance as weight
    for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
            const curr = nodes[`${i}_${j}`];
            const neighbors = [
                nodes[`${i+1}_${j}`],
                nodes[`${i-1}_${j}`],
                nodes[`${i}_${j+1}`],
                nodes[`${i}_${j-1}`]
            ].filter(Boolean);

            neighbors.forEach(nb => {
                const dist = haversineDistance(curr.lat, curr.lng, nb.lat, nb.lng);
                adjacency[curr.id].push({ to: nb.id, weight: dist });
            });
        }
    }

    // Find nearest node to a coordinate
    function nearestNode(lat, lng) {
        let best = null, bestDist = Infinity;
        Object.values(nodes).forEach(n => {
            const d = haversineDistance(lat, lng, n.lat, n.lng);
            if (d < bestDist) { bestDist = d; best = n; }
        });
        return best;
    }

    const sourceNode = nearestNode(userLat, userLng);
    const destNode   = nearestNode(destLat, destLng);

    return { adjacency, nodes, sourceNode, destNode };
}

function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // metres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI/180) *
              Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function dijkstraLocal(adjacency, sourceId, destId) {
    const dist = {};
    const prev = {};
    const visited = {};

    Object.keys(adjacency).forEach(id => dist[id] = Infinity);
    dist[sourceId] = 0;

    // Simple priority queue using array (fine for small graphs)
    const pq = [{ id: sourceId, d: 0 }];

    while (pq.length) {
        pq.sort((a, b) => a.d - b.d);
        const { id: u, d: dU } = pq.shift();

        if (visited[u]) continue;
        visited[u] = true;
        if (u == destId) break;

        (adjacency[u] || []).forEach(edge => {
            const alt = dU + edge.weight;
            if (alt < dist[edge.to]) {
                dist[edge.to] = alt;
                prev[edge.to] = u;
                pq.push({ id: edge.to, d: alt });
            }
        });
    }

    // Reconstruct path
    const path = [];
    let cur = destId;
    while (cur !== undefined) {
        path.unshift(cur);
        cur = prev[cur];
    }

    return { distance: dist[destId], path };
}
// Expose routeTo globally for map popup button clicks
window.App = { routeTo };
