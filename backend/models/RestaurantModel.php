<?php
/**
 * RestaurantModel.php
 *
 * Data-access layer for restaurants.
 * Uses the Haversine formula inside SQL for accurate great-circle distance.
 */
require_once __DIR__ . '/../db/Database.php';

class RestaurantModel {

    private PDO $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // ──────────────────────────────────────────────────────────
    // Haversine SQL fragment (returns km)
    // R ≈ 6371 km
    // ──────────────────────────────────────────────────────────
    private function haversineExpr(string $latParam, string $lngParam): string {
        return "
            (6371 * ACOS(
                COS(RADIANS($latParam)) * COS(RADIANS(r.latitude))  *
                COS(RADIANS(r.longitude) - RADIANS($lngParam))
                + SIN(RADIANS($latParam)) * SIN(RADIANS(r.latitude))
            ))
        ";
    }

    // ──────────────────────────────────────────────────────────
    // Fetch restaurants within $radiusKm of ($lat, $lng)
    // Optional: filter by cuisine name
    // ──────────────────────────────────────────────────────────
    public function findNearby(
        float  $lat,
        float  $lng,
        float  $radiusKm   = 2.0,
        ?string $cuisine   = null,
        int    $limit      = 50
    ): array {
        

        $sql = "
            SELECT
                r.*,
                c.name  AS cuisine_name,
                c.emoji AS cuisine_emoji,
               (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(r.latitude)) *
                COS(RADIANS(r.longitude) - RADIANS(?))
                + SIN(RADIANS(?)) * SIN(RADIANS(r.latitude))
            )) AS distance_km
        FROM restaurants r
        JOIN cuisines c ON c.id = r.cuisine_id
        WHERE r.is_open = 1
          AND (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(r.latitude)) *
                COS(RADIANS(r.longitude) - RADIANS(?))
                + SIN(RADIANS(?)) * SIN(RADIANS(r.latitude))
              )) <= ?
        ";

        $params = [$lat, $lng, $lat, $lat, $lng, $lat, $radiusKm ];

        if ($cuisine !== null && $cuisine !== '') {
            $sql .= " AND LOWER(c.name) = LOWER(?)";
            $params[] = $cuisine;
        }

	$sql .= " ORDER BY distance_km ASC LIMIT ?";
	$params[]= (int)$limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    // ──────────────────────────────────────────────────────────
    // Fetch single restaurant by id (with nearest graph node)
    // ──────────────────────────────────────────────────────────
    public function findById(int $id): ?array {
        $stmt = $this->db->prepare("
            SELECT r.*, c.name AS cuisine_name, c.emoji AS cuisine_emoji,
                   rn.node_id AS graph_node_id
            FROM restaurants r
            JOIN cuisines c ON c.id = r.cuisine_id
            LEFT JOIN restaurant_nodes rn ON rn.restaurant_id = r.id
            WHERE r.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    // ──────────────────────────────────────────────────────────
    // All cuisines (for filter dropdown)
    // ──────────────────────────────────────────────────────────
    public function getCuisines(): array {
        return $this->db->query("SELECT * FROM cuisines ORDER BY name")->fetchAll();
    }

    // ──────────────────────────────────────────────────────────
    // Graph data – all nodes + adjacency list
    // ──────────────────────────────────────────────────────────
    public function getGraph(): array {
        $nodes = $this->db
            ->query("SELECT * FROM graph_nodes")
            ->fetchAll();

        $edges = $this->db
            ->query("SELECT node_from, node_to, weight, road_name FROM graph_edges")
            ->fetchAll();

        // Build adjacency list indexed by node_id
        $adj = [];
        foreach ($nodes as $n) {
            $adj[(int)$n['id']] = [];
        }
        foreach ($edges as $e) {
            $adj[(int)$e['node_from']][] = [
                'to'     => (int)$e['node_to'],
                'weight' => (float)$e['weight'],
                'road'   => $e['road_name'],
            ];
        }

        return ['nodes' => $nodes, 'adjacency' => $adj];
    }

    // ──────────────────────────────────────────────────────────
    // Nearest graph node to arbitrary (lat, lng)
    // ──────────────────────────────────────────────────────────
    public function nearestNode(float $lat, float $lng): ?array {
	    $stmt = $this->db->prepare("
            SELECT gn.*,
            (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(gn.latitude))  *
                COS(RADIANS(gn.longitude) - RADIANS(?))
                + SIN(RADIANS(?)) * SIN(RADIANS(gn.latitude))
              )) AS dist_km

        
            FROM graph_nodes gn
            ORDER BY dist_km ASC
            LIMIT 1
        ");
        $stmt->execute([$lat, $lng, $lat]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
