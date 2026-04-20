<?php
/**
 * Algorithms.php
 *
 * Contains:
 *  1. RankingEngine  – composite score (rating × popularity × distance × cuisine)
 *  2. QuickSort      – in-place quick-sort used for final result ordering
 *  3. Dijkstra       – shortest-path on the road graph
 */

// ──────────────────────────────────────────────────────────────
// 1. Ranking Engine
// ──────────────────────────────────────────────────────────────
class RankingEngine {

    /**
     * Weights (must sum to 1 for clarity, though not enforced):
     *  w_rating     = 0.35
     *  w_popularity = 0.25   (log-normalised review count)
     *  w_distance   = 0.30   (inverse; closer = higher score)
     *  w_cuisine    = 0.10   (bonus if cuisine matches preference)
     */
    private const W_RATING     = 0.35;
    private const W_POPULARITY = 0.25;
    private const W_DISTANCE   = 0.30;
    private const W_CUISINE    = 0.10;

    /**
     * @param array  $restaurants  Rows from DB (each must have rating,
     *                             review_count, distance_km, cuisine_name)
     * @param string $cuisinePref  User's preferred cuisine ('' = no pref)
     * @return array  Same rows with added 'rank_score' field
     */
    public static function scoreAll(array $restaurants, string $cuisinePref = ''): array {
        if (empty($restaurants)) return [];

        // Pre-compute max values for normalisation
        $maxRating   = max(array_column($restaurants, 'rating')) ?: 5.0;
        $maxLogPop   = log(max(array_column($restaurants, 'review_count')) + 1) ?: 1.0;
        $maxDistance = max(array_column($restaurants, 'distance_km')) ?: 1.0;

        foreach ($restaurants as &$r) {
            $normRating   = (float)$r['rating'] / $maxRating;
            $normPop      = log((float)$r['review_count'] + 1) / $maxLogPop;
            // Inverse distance: closer gets higher score
            $normDist     = 1.0 - ((float)$r['distance_km'] / ($maxDistance + PHP_FLOAT_EPSILON));
            $cuisineBonus = (strcasecmp($r['cuisine_name'], $cuisinePref) === 0) ? 1.0 : 0.0;

            $r['rank_score'] = round(
                self::W_RATING     * $normRating   +
                self::W_POPULARITY * $normPop      +
                self::W_DISTANCE   * $normDist     +
                self::W_CUISINE    * $cuisineBonus,
                6
            );
        }
        unset($r);
        return $restaurants;
    }
}


// ──────────────────────────────────────────────────────────────
// 2. QuickSort  (sorts by 'rank_score' descending)
// ──────────────────────────────────────────────────────────────
class QuickSort {

    /**
     * Public entry point.
     * @param array &$arr  Array of associative arrays with 'rank_score'
     */
    public static function sortByScore(array &$arr): void {
        if (count($arr) < 2) return;
        self::quickSort($arr, 0, count($arr) - 1);
    }

    private static function quickSort(array &$arr, int $lo, int $hi): void {
        if ($lo >= $hi) return;
        $p = self::partition($arr, $lo, $hi);
        self::quickSort($arr, $lo, $p - 1);
        self::quickSort($arr, $p + 1, $hi);
    }

    /**
     * Lomuto partition – pivot is last element.
     * Sorts DESCENDING (higher score → lower index).
     */
    private static function partition(array &$arr, int $lo, int $hi): int {
        $pivot = (float)$arr[$hi]['rank_score'];
        $i     = $lo - 1;

        for ($j = $lo; $j < $hi; $j++) {
            // Descending: swap when element is GREATER than pivot
            if ((float)$arr[$j]['rank_score'] > $pivot) {
                $i++;
                [$arr[$i], $arr[$j]] = [$arr[$j], $arr[$i]];
            }
        }
        [$arr[$i + 1], $arr[$hi]] = [$arr[$hi], $arr[$i + 1]];
        return $i + 1;
    }
}


// ──────────────────────────────────────────────────────────────
// 3. Dijkstra Shortest Path
// ──────────────────────────────────────────────────────────────
class Dijkstra {

    /**
     * @param array $adjacency  [ node_id => [ ['to'=>int,'weight'=>float,'road'=>str], … ] ]
     * @param int   $source     Starting node id
     * @param int   $target     Destination node id
     * @return array|null  [
     *     'distance' => float (metres),
     *     'path'     => int[]  (node ids source→target),
     *     'roads'    => string[] (road names for each segment)
     * ]
     */
    public static function shortestPath(array $adjacency, int $source, int $target): ?array {
        $INF  = PHP_FLOAT_MAX;
        $dist = [];
        $prev = [];
        $road = [];    // road name on best edge to each node

        foreach (array_keys($adjacency) as $v) {
            $dist[$v] = $INF;
            $prev[$v] = null;
            $road[$v] = '';
        }
        $dist[$source] = 0.0;

        // Min-heap using SplPriorityQueue (negated priorities = min-heap)
        $pq = new SplPriorityQueue();
        $pq->setExtractFlags(SplPriorityQueue::EXTR_BOTH);
        $pq->insert($source, 0.0);   // priority queue is max-heap, negate below

        // We'll use a visited set to skip stale entries
        $visited = [];

        while (!$pq->isEmpty()) {
            $top  = $pq->extract();
            $u    = $top['data'];
            $dU   = -$top['priority'];   // we inserted negative priorities

            if (isset($visited[$u])) continue;
            $visited[$u] = true;

            if ($u === $target) break;

            if (!isset($adjacency[$u])) continue;

            foreach ($adjacency[$u] as $edge) {
                $v      = $edge['to'];
                $newDst = $dU + $edge['weight'];
                if ($newDst < $dist[$v]) {
                    $dist[$v] = $newDst;
                    $prev[$v] = $u;
                    $road[$v] = $edge['road'];
                    $pq->insert($v, -$newDst);   // negate for min-heap
                }
            }
        }

        if ($dist[$target] === $INF) return null;   // no path

        // Reconstruct path
        $path  = [];
        $roads = [];
        $cur   = $target;
        while ($cur !== null) {
            array_unshift($path, $cur);
            if ($prev[$cur] !== null) {
                array_unshift($roads, $road[$cur]);
            }
            $cur = $prev[$cur];
        }

        return [
            'distance' => $dist[$target],
            'path'     => $path,
            'roads'    => $roads,
        ];
    }
}
