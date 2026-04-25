# 🍽️ Forkmap — Restaurant Finder

A full-stack restaurant discovery platform using **PHP + MySQL + Leaflet.js**.

---

## Architecture Overview

```
restaurant-finder/
│
├── index.html                    ← App shell (Leaflet + ES-module entry)
├── .htaccess                     ← Apache URL rewriting (/api/*)
│
├── frontend/
│   ├── css/style.css             ← Dark editorial theme
│   └── js/
│       ├── app.js                ← UI controller, state, event bindings
│       ├── map.js                ← Leaflet MapManager (markers, routes, popups)
│       └── api.js                ← Fetch/AJAX REST client
│
├── backend/
│   ├── api/index.php             ← REST router (5 endpoints)
│   ├── db/Database.php           ← PDO singleton
│   ├── models/RestaurantModel.php← Data access + Haversine SQL
|   ├──services/OverpassService.php
│   └── algorithms/Algorithms.php ← RankingEngine, QuickSort, Dijkstra
│
└── sql/
    ├── schema.sql                ← Table definitions
    └── seed.sql                  ← Sample NYC data (15 restaurants, 20 nodes)
```

---

## Prerequisites

| Tool    | Version    |
|---------|-----------|
| PHP     | ≥ 8.1     |
| MySQL   | ≥ 8.0     |
| Apache  | mod_rewrite enabled |

---

## Installation

### 1. Clone & place in web root

```bash
git clone <repo>
cp -r restaurant-finder /var/www/html/
```

### 2. Create the database

```bash
mysql -u root -p < sql/schema.sql
mysql -u root -p restaurant_finder < sql/seed.sql
```

### 3. Configure credentials

Edit `backend/db/Database.php`:

```php
private static string $host   = 'localhost';
private static string $dbname = 'restaurant_finder';
private static string $user   = 'your_user';
private static string $pass   = 'your_password';
```

### 4. Enable mod_rewrite (Ubuntu/Debian)

```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

Ensure your VirtualHost has `AllowOverride All`.

### 5. Open in browser

```
http://localhost/restaurant-finder/
```

---

## REST API Endpoints

All endpoints return `application/json`.

### `GET /api/restaurants`

Search for nearby restaurants.

| Param    | Type   | Required | Description                     |
|----------|--------|----------|---------------------------------|
| lat      | float  | ✅       | User latitude                   |
| lng      | float  | ✅       | User longitude                  |
| radius   | float  | —        | Search radius in km (default 2) |
| cuisine  | string | —        | Filter by cuisine name          |
| limit    | int    | —        | Max results (default 20)        |

**Response:**
```json
{
  "count": 8,
  "results": [
    {
      "id": 2,
      "name": "Sakura Garden",
      "cuisine_name": "Japanese",
      "cuisine_emoji": "🍱",
      "rating": "4.7",
      "review_count": 1203,
      "distance_km": 0.34,
      "rank_score": 0.891234,
      ...
    }
  ]
}
```

---

### `GET /api/restaurants/{id}`

Single restaurant with graph node mapping.

---

### `GET /api/cuisines`

All available cuisine types for the filter dropdown.

---

### `GET /api/route`

Compute Dijkstra shortest path.

| Param         | Type  | Description                          |
|---------------|-------|--------------------------------------|
| user_lat      | float | User latitude                        |
| user_lng      | float | User longitude                       |
| restaurant_id | int   | Target restaurant ID                 |

OR supply raw node IDs:

| Param     | Type | Description        |
|-----------|------|--------------------|
| from_node | int  | Source node ID     |
| to_node   | int  | Destination node ID|

**Response:**
```json
{
  "distance_m": 810,
  "distance_km": 0.81,
  "path": [
    { "node_id": 6, "label": "6th Ave & 42nd St", "latitude": 40.7536, "longitude": -73.9858 },
    ...
  ],
  "roads": ["42nd St", "6th Ave", "45th St"]
}
```

---

### `GET /api/graph`

Raw graph data (all nodes + adjacency list) for the road network overlay.

---

## Algorithms Deep Dive

### 1. Haversine Formula (SQL)

Implemented directly inside MySQL queries for server-side spatial filtering:

```sql
(6371 * ACOS(
    COS(RADIANS(:lat)) * COS(RADIANS(r.latitude)) *
    COS(RADIANS(r.longitude) - RADIANS(:lng))
    + SIN(RADIANS(:lat)) * SIN(RADIANS(r.latitude))
)) AS distance_km
```

This correctly computes great-circle distance in kilometres on the Earth's surface.
Indexed `(latitude, longitude)` columns reduce the scan to the bounding box first.

---

### 2. Composite Ranking Function

`RankingEngine::scoreAll()` assigns each restaurant a score ∈ [0, 1]:

```
score = 0.35 × norm_rating
      + 0.25 × log_norm_popularity
      + 0.30 × (1 – norm_distance)    ← inverse distance
      + 0.10 × cuisine_match_bonus
```

All components are normalised to [0, 1] before weighting so no single dimension dominates.
The log normalisation of `review_count` prevents restaurants with massive review counts
from drowning out other signals.

---

### 3. Manual QuickSort

`QuickSort::sortByScore()` uses **Lomuto partition** with descending order:

```
Pivot = arr[hi].rank_score
i     = lo − 1
for j = lo … hi−1:
    if arr[j].rank_score > pivot:   ← descending: swap when GREATER
        i++; swap(arr[i], arr[j])
swap(arr[i+1], arr[hi])
return i + 1
```

Average O(n log n); no PHP built-in sort used in the ranked result pipeline.

---

### 4. Dijkstra Shortest Path

`Dijkstra::shortestPath()` uses PHP's `SplPriorityQueue` as a min-heap
(priorities stored as negated values since PHP's SPL is a max-heap):

```
dist[source] = 0; all others = ∞
PQ ← {(source, 0)}

while PQ not empty:
    (u, d) = extract_min(PQ)
    if visited[u]: continue
    visited[u] = true
    if u == target: break

    for each (v, w, road) in adj[u]:
        if d + w < dist[v]:
            dist[v] = d + w
            prev[v] = u
            road[v] = road_name
            PQ ← (v, −dist[v])
```

Path reconstruction walks `prev[]` back from target to source.
The result includes coordinate-enriched path nodes for Leaflet polyline rendering.

---

## Frontend Architecture

### `MapManager` (map.js)
- Initialises Leaflet with OpenStreetMap tiles
- Custom CSS `div-icon` pins with hue derived from `rank_score`
- `plotRestaurants()` → animated markers with rich popups
- `drawRoute()` → red polyline + intermediate waypoint circles
- `drawGraph()` → purple debug overlay of all road nodes

### `Api` (api.js)
- Thin `fetch`-based client — no dependencies
- All params serialised as URL search params
- Errors propagated as exceptions for the controller to catch

### `app.js`
- Central state object `{ userLat, userLng, radius, cuisine, restaurants }`
- Geolocation API integration with fallback to NYC defaults
- Toast notification system with auto-dismiss
- Card animations using staggered `animation-delay`

---

## Database Schema

```
cuisines          restaurants           graph_nodes
────────────      ─────────────────     ────────────
id                id                    id
name              name                  label
emoji             cuisine_id ──┐        latitude
                  latitude     │        longitude
                  longitude    │
                  rating       │   graph_edges
                  review_count │   ────────────
                  price_range  │   id
                  address      │   node_from ──┐
                  is_open      │   node_to   ──┤ → graph_nodes
                               │   weight       │
                  ┌────────────┘   road_name
                  └→ cuisines
                                restaurant_nodes
                                ────────────────
                                restaurant_id → restaurants
                                node_id       → graph_nodes
```

---

## License

MIT
