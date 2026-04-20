<?php
/**
 * Database.php – PDO singleton for MySQL connection
 */
class Database {
    private static ?PDO $instance = null;

    // ── Configuration ─────────────────────────────────────────
    private static string $host   = 'localhost';
    private static string $dbname = 'restaurant_finder';
    private static string $user   = 'root';
    private static string $pass   = 'Arunima@31#Secure';
    private static string $charset= 'utf8mb4';

    private function __construct() {}
    private function __clone() {}

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                self::$host,
                self::$dbname,
                self::$charset
            );
            try {
                self::$instance = new PDO($dsn, self::$user, self::$pass, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
                exit;
            }
        }
        return self::$instance;
    }
}
