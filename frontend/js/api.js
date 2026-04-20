/**
 * api.js  –  Thin AJAX/Fetch client for the PHP REST API
 */


const API_BASE = '/restaurant-finder/backend/api/index.php';

const Api = (() => {

    /**
     * Core fetch wrapper with JSON parsing and error handling
     */
    async function request(endpoint, params = {}) {
        const url = new URL(API_BASE , window.location.origin);
        url.searchParams.set('_path',endpoint);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') {
                url.searchParams.set(k, v);
            }
        });

        try {
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error(`[API] ${endpoint}`, err);
            throw err;
        }
    }

    // ── Public methods ─────────────────────────────────────────

    /**
     * Search nearby restaurants.
     * @param {number} lat
     * @param {number} lng
     * @param {object} opts – { radius, cuisine, limit }
     */
    function searchRestaurants(lat, lng, opts = {}) {
        return request('/restaurants', {
            lat,
            lng,
            radius:  opts.radius  ?? 2.0,
            cuisine: opts.cuisine ?? '',
            limit:   opts.limit   ?? 20,
        });
    }

    /**
     * Get a single restaurant by id.
     */
    function getRestaurant(id) {
        return request(`/restaurants/${id}`);
    }

    /**
     * Get all cuisine types.
     */
    function getCuisines() {
        return request('/cuisines');
    }

    /**
     * Get Dijkstra route from user location to a restaurant.
     * @param {number} userLat
     * @param {number} userLng
     * @param {number} restaurantId
     */
    function getRoute(userLat, userLng, restaurantId) {
        return request('/route', {
            user_lat:      userLat,
            user_lng:      userLng,
            restaurant_id: restaurantId,
        });
    }

    /**
     * Get the raw graph (nodes + adjacency) for visualisation.
     */
    function getGraph() {
        return request('/graph');
    }

    return { searchRestaurants, getRestaurant, getCuisines, getRoute, getGraph };
})();

export default Api;
