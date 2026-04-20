<?php
/**
 * index.php  –  API entry point / router
 */

// ── Headers ───────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Autoload ──────────────────────────────────────────────────
require_once __DIR__ . '/../db/Database.php';
require_once __DIR__ . '/../models/RestaurantModel.php';
require_once __DIR__ . '/../algorithms/Algorithms.php';
require_once __DIR__ . '/../services/OverpassService.php';

// ── Router ────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];

// Priority 1: use ?_path=/restaurants if provided (frontend direct mode)
if (!empty($_GET['_path'])) {
    $uri = '/' . ltrim($_GET['_path'], '/');
} else {
    // Priority 2: derive from URL path
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $uri = preg_replace('#^/restaurant-finder/backend/api(/index\.php)?#', '', $uri);
    $uri = rtrim($uri, '/');
    if ($uri === '') $uri = '/restaurants';
}

// Match /restaurants/{id}
if (preg_match('#^/restaurants/(\d+)$#', $uri, $m)) {
    handleRestaurantById((int)$m[1]);
    exit;
}

switch ($uri) {
    case '/restaurants':
        handleRestaurants();
        break;
    case '/cuisines':
        handleCuisines();
        break;
    case '/route':
        handleRoute();
        break;
    case '/graph':
        handleGraph();
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => "Endpoint '$uri' not found."]);
}

// ── Handlers ──────────────────────────────────────────────────

function handleRestaurants(): void {
    $lat     = filter_input(INPUT_GET, 'lat',    FILTER_VALIDATE_FLOAT);
    $lng     = filter_input(INPUT_GET, 'lng',    FILTER_VALIDATE_FLOAT);
    $radius  = filter_input(INPUT_GET, 'radius', FILTER_VALIDATE_FLOAT) ?: 2.0;
    $cuisine = trim($_GET['cuisine'] ?? '');
    $limit   = min((int)($_GET['limit'] ?? 50), 100);

    if ($lat === false || $lat === null || $lng === false || $lng === null) {
        http_response_code(400);
        echo json_encode(['error' => 'lat and lng are required query parameters.']);
        return;
    }

    $results = OverpassService::fetchNearby($lat, $lng, $radius, $cuisine ?: null, $limit);
    $source  = 'overpass';

    // Fallback to local DB if Overpass is unavailable or returned nothing
    if ($results === null || count($results) === 0) {
        $model   = new RestaurantModel();
        $results = $model->findNearby($lat, $lng, $radius, $cuisine ?: null, $limit);
        $source  = 'db';
    }

    $scored = RankingEngine::scoreAll($results, $cuisine);
    QuickSort::sortByScore($scored);

    echo json_encode(['count' => count($scored), 'source' => $source, 'results' => $scored]);
}

function handleRestaurantById(int $id): void {
    $model = new RestaurantModel();
    $row   = $model->findById($id);
    if ($row === null) {
        http_response_code(404);
        echo json_encode(['error' => "Restaurant $id not found."]);
        return;
    }
    echo json_encode($row);
}

function handleCuisines(): void {
    $model = new RestaurantModel();
    echo json_encode(['cuisines' => $model->getCuisines()]);
}

function handleRoute(): void {
    $model = new RestaurantModel();
    $graph = $model->getGraph();
    $adj   = $graph['adjacency'];

    $fromNode = filter_input(INPUT_GET, 'from_node', FILTER_VALIDATE_INT);
    if ($fromNode === false || $fromNode === null) {
        $userLat = filter_input(INPUT_GET, 'user_lat', FILTER_VALIDATE_FLOAT);
        $userLng = filter_input(INPUT_GET, 'user_lng', FILTER_VALIDATE_FLOAT);
        if ($userLat && $userLng) {
            $node     = $model->nearestNode($userLat, $userLng);
            $fromNode = $node ? (int)$node['id'] : null;
        }
    }

    $toNode = filter_input(INPUT_GET, 'to_node', FILTER_VALIDATE_INT);
    if ($toNode === false || $toNode === null) {
        $restId = filter_input(INPUT_GET, 'restaurant_id', FILTER_VALIDATE_INT);
        if ($restId) {
            $rest   = $model->findById($restId);
            $toNode = $rest ? (int)($rest['graph_node_id'] ?? 0) : null;
        }
    }

    if (!$fromNode || !$toNode) {
        http_response_code(400);
        echo json_encode(['error' => 'Could not resolve source/destination nodes.']);
        return;
    }

    $result = Dijkstra::shortestPath($adj, $fromNode, $toNode);
    if ($result === null) {
        http_response_code(404);
        echo json_encode(['error' => 'No path found between the given nodes.']);
        return;
    }

    $nodeMap = array_column($graph['nodes'], null, 'id');
    $pathGeo = array_map(fn($nid) => [
        'node_id'   => $nid,
        'label'     => $nodeMap[$nid]['label']     ?? '',
        'latitude'  => (float)($nodeMap[$nid]['latitude']  ?? 0),
        'longitude' => (float)($nodeMap[$nid]['longitude'] ?? 0),
    ], $result['path']);

    echo json_encode([
        'distance_m'  => round($result['distance']),
        'distance_km' => round($result['distance'] / 1000, 2),
        'path'        => $pathGeo,
        'roads'       => $result['roads'],
    ]);
}

function handleGraph(): void {
    $model = new RestaurantModel();
    echo json_encode($model->getGraph());
}
