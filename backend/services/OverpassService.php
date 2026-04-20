<?php
/**
 * OverpassService.php
 *
 * Fetches real restaurant data from the OpenStreetMap Overpass API
 * for any location in the world.
 */
class OverpassService {

    private const ENDPOINTS = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://z.overpass-api.de/api/interpreter',
    ];
    private const TIMEOUT_S  = 25;
    private const CACHE_TTL  = 300; // seconds

    // Maps OSM cuisine tags → [display name, emoji]
    private const CUISINE_MAP = [
        'italian'        => ['Italian',       '🍝'],
        'pizza'          => ['Italian',       '🍝'],
        'japanese'       => ['Japanese',      '🍱'],
        'sushi'          => ['Japanese',      '🍱'],
        'ramen'          => ['Japanese',      '🍱'],
        'mexican'        => ['Mexican',       '🌮'],
        'tacos'          => ['Mexican',       '🌮'],
        'indian'         => ['Indian',        '🍛'],
        'bangladeshi'    => ['Indian',        '🍛'],
        'chinese'        => ['Chinese',       '🥡'],
        'american'       => ['American',      '🍔'],
        'burger'         => ['American',      '🍔'],
        'thai'           => ['Thai',          '🍜'],
        'french'         => ['French',        '🥐'],
        'mediterranean'  => ['Mediterranean', '🫒'],
        'greek'          => ['Mediterranean', '🫒'],
        'korean'         => ['Korean',        '🥩'],
        'spanish'        => ['Spanish',       '🥘'],
        'vietnamese'     => ['Vietnamese',    '🍲'],
        'turkish'        => ['Turkish',       '🌯'],
        'kebab'          => ['Turkish',       '🌯'],
        'lebanese'       => ['Lebanese',      '🧆'],
        'middle_eastern' => ['Lebanese',      '🧆'],
        'seafood'        => ['Seafood',       '🦞'],
        'steak_house'    => ['Steakhouse',    '🥩'],
        'barbecue'       => ['BBQ',           '🍖'],
        'sandwich'       => ['Sandwiches',    '🥪'],
        'coffee_shop'    => ['Café',          '☕'],
        'cafe'           => ['Café',          '☕'],
    ];

    /**
     * Fetch restaurants near ($lat, $lng) within $radiusKm.
     * Returns normalized array ready for RankingEngine.
     *
     * @param float   $lat
     * @param float   $lng
     * @param float   $radiusKm
     * @param ?string $cuisine   Display name from dropdown (e.g. "Italian")
     * @param int     $limit
     * @return array
     */
    public static function fetchNearby(
        float   $lat,
        float   $lng,
        float   $radiusKm,
        ?string $cuisine = null,
        int     $limit   = 50
    ): array {
        $cacheKey = md5("$lat|$lng|$radiusKm|$cuisine|$limit");
        $cached   = self::readCache($cacheKey);
        if ($cached !== null) return $cached;

        $radiusM = (int)($radiusKm * 1000);

        // Build cuisine filter for Overpass (regex, case-insensitive)
        $cuisineFilter = '';
        if ($cuisine) {
            $osm = self::displayToOsmTag($cuisine);
            if ($osm) {
                $cuisineFilter = '["cuisine"~"' . addslashes($osm) . '",i]';
            }
        }

        $timeout = self::TIMEOUT_S;
        $bbox    = "(around:{$radiusM},{$lat},{$lng})";
        $query   = "[out:json][timeout:{$timeout}];\n"
                 . "(\n"
                 . "  node[\"amenity\"=\"restaurant\"]{$cuisineFilter}{$bbox};\n"
                 . "  way[\"amenity\"=\"restaurant\"]{$cuisineFilter}{$bbox};\n"
                 . ");\n"
                 . "out center {$limit};";

        $raw = self::post($query);
        if ($raw === null) return [];

        $data = json_decode($raw, true);
        if (!isset($data['elements'])) return [];

        $results = self::normalize($data['elements'], $lat, $lng);
        self::writeCache($cacheKey, $results);
        return $results;
    }

    // ── Helpers ────────────────────────────────────────────────

    /**
     * POST query to Overpass API, trying each mirror with 2 retries each.
     * Returns raw JSON string or null if all attempts fail.
     */
    private static function post(string $query): ?string {
        foreach (self::ENDPOINTS as $endpoint) {
            for ($attempt = 0; $attempt < 2; $attempt++) {
                if ($attempt > 0) sleep(2);

                $ch = curl_init($endpoint);
                curl_setopt_array($ch, [
                    CURLOPT_POST           => true,
                    CURLOPT_POSTFIELDS     => 'data=' . urlencode($query),
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => self::TIMEOUT_S + 5,
                    CURLOPT_USERAGENT      => 'RestaurantFinderApp/1.0',
                ]);
                $resp = curl_exec($ch);
                $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $err  = curl_error($ch);
                curl_close($ch);

                if ($resp && !$err && $code === 200 && str_starts_with(ltrim($resp), '{')) {
                    return $resp;
                }
            }
        }
        return null;
    }

    /**
     * Normalize Overpass elements to the shape the frontend expects.
     */
    private static function normalize(array $elements, float $userLat, float $userLng): array {
        $results = [];
        foreach ($elements as $el) {
            // Nodes have lat/lon; ways have center.lat/center.lon
            $elLat = $el['lat'] ?? ($el['center']['lat'] ?? null);
            $elLng = $el['lon'] ?? ($el['center']['lon'] ?? null);
            if ($elLat === null || $elLng === null) continue;

            $tags = $el['tags'] ?? [];
            $name = $tags['name'] ?? null;
            if (!$name) continue;

            // Cuisine – take first tag if semicolon-separated
            $rawCuisine = strtolower(explode(';', $tags['cuisine'] ?? '')[0]);
            $rawCuisine = strtolower(explode(',', $rawCuisine)[0]);
            $rawCuisine = trim($rawCuisine);

            [$cuisineName, $cuisineEmoji] = self::mapCuisine($rawCuisine);

            $results[] = [
                'id'            => $el['id'],
                'name'          => $name,
                'cuisine_name'  => $cuisineName,
                'cuisine_emoji' => $cuisineEmoji,
                'latitude'      => (float)$elLat,
                'longitude'     => (float)$elLng,
                'rating'        => self::syntheticRating($el['id']),
                'review_count'  => self::syntheticReviews($el['id']),
                'price_range'   => self::syntheticPrice($tags),
                'address'       => self::buildAddress($tags),
                'distance_km'   => round(self::haversine($userLat, $userLng, $elLat, $elLng), 4),
                'is_open'       => 1,
            ];
        }
        return $results;
    }

    /**
     * Map OSM cuisine tag to [display name, emoji].
     */
    private static function mapCuisine(string $raw): array {
        if (isset(self::CUISINE_MAP[$raw])) {
            return self::CUISINE_MAP[$raw];
        }
        // Partial match (e.g. "chinese_regional" → Chinese)
        foreach (self::CUISINE_MAP as $key => [$name, $emoji]) {
            if (str_contains($raw, $key)) return [$name, $emoji];
        }
        return ['Restaurant', '🍽️'];
    }

    /**
     * Convert frontend display name (e.g. "Italian") back to an OSM tag pattern.
     */
    private static function displayToOsmTag(string $display): ?string {
        $display = strtolower($display);
        $map = [
            'italian'       => 'italian|pizza',
            'japanese'      => 'japanese|sushi|ramen',
            'mexican'       => 'mexican|tacos',
            'indian'        => 'indian|bangladeshi',
            'chinese'       => 'chinese',
            'american'      => 'american|burger',
            'thai'          => 'thai',
            'french'        => 'french',
            'mediterranean' => 'mediterranean|greek',
            'korean'        => 'korean',
        ];
        return $map[$display] ?? $display;
    }

    private static function buildAddress(array $tags): string {
        $parts = array_filter([
            isset($tags['addr:housenumber'], $tags['addr:street'])
                ? $tags['addr:housenumber'] . ' ' . $tags['addr:street']
                : ($tags['addr:street'] ?? null),
            $tags['addr:city']       ?? null,
            $tags['addr:postcode']   ?? null,
            $tags['addr:country']    ?? null,
        ]);
        return $parts ? implode(', ', $parts) : ($tags['addr:full'] ?? '');
    }

    /** Haversine distance in km */
    private static function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float {
        $R  = 6371.0;
        $dL = deg2rad($lat2 - $lat1);
        $dG = deg2rad($lng2 - $lng1);
        $a  = sin($dL / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dG / 2) ** 2;
        return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * Deterministic "fake" rating seeded from OSM id so results are stable.
     * Produces values between 3.5 and 5.0.
     */
    private static function syntheticRating(int $osmId): float {
        return round(3.5 + (($osmId % 31) / 31) * 1.5, 1);
    }

    private static function syntheticReviews(int $osmId): int {
        return 50 + ($osmId % 950);
    }

    private static function syntheticPrice(array $tags): int {
        $raw = strtolower($tags['price_range'] ?? $tags['fee'] ?? '');
        if (str_contains($raw, 'expensive') || str_contains($raw, 'high')) return 4;
        if (str_contains($raw, 'moderate'))  return 2;
        return 2;
    }

    // ── Simple file cache ──────────────────────────────────────

    private static function cacheDir(): string {
        return sys_get_temp_dir() . '/overpass_cache/';
    }

    private static function readCache(string $key): ?array {
        $file = self::cacheDir() . $key . '.json';
        if (!file_exists($file)) return null;
        if (time() - filemtime($file) > self::CACHE_TTL) return null;
        $data = json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : null;
    }

    private static function writeCache(string $key, array $data): void {
        $dir = self::cacheDir();
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents($dir . $key . '.json', json_encode($data));
    }
}
