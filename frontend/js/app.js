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
async function routeTo(restaurantId) {
    setLoading(true);
    MapManager.clearRoute();
    els.routeInfo.classList.add('hidden');

    try {
        const data = await Api.getRoute(state.userLat, state.userLng, restaurantId);
        MapManager.drawRoute(data.path);

        const r = state.restaurants.find(x => x.id == restaurantId);
        els.routeInfo.innerHTML = `
            <strong>Route to ${r ? r.name : 'restaurant'}</strong><br>
            Distance: <b>${data.distance_km} km</b> (${data.distance_m} m)<br>
            Via: ${data.roads.join(' → ')}`;
        els.routeInfo.classList.remove('hidden');
        toast(`Route found: ${data.distance_km} km`, 'success');
    } catch (err) {
        toast('Routing failed: ' + err.message, 'error');
    } finally {
        setLoading(false);
    }
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

// Expose routeTo globally for map popup button clicks
window.App = { routeTo };
