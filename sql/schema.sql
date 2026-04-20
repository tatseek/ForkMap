-- ============================================================
-- Restaurant Finder Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS restaurant_finder
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE restaurant_finder;

-- ============================================================
-- Cuisines lookup table
-- ============================================================
CREATE TABLE IF NOT EXISTS cuisines (
    id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name      VARCHAR(60) NOT NULL UNIQUE,
    emoji     VARCHAR(8)  NOT NULL DEFAULT '🍽️'
) ENGINE=InnoDB;

-- ============================================================
-- Restaurants
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurants (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120)   NOT NULL,
    cuisine_id    INT UNSIGNED   NOT NULL,
    latitude      DECIMAL(10,7)  NOT NULL,
    longitude     DECIMAL(10,7)  NOT NULL,
    rating        DECIMAL(2,1)   NOT NULL DEFAULT 0.0  CHECK (rating BETWEEN 0 AND 5),
    review_count  INT UNSIGNED   NOT NULL DEFAULT 0,
    price_range   TINYINT        NOT NULL DEFAULT 2     CHECK (price_range BETWEEN 1 AND 4),
    address       VARCHAR(255)   NOT NULL DEFAULT '',
    phone         VARCHAR(30)    NOT NULL DEFAULT '',
    image_url     VARCHAR(512)   NOT NULL DEFAULT '',
    is_open       TINYINT(1)     NOT NULL DEFAULT 1,
    created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_restaurant_cuisine FOREIGN KEY (cuisine_id)
        REFERENCES cuisines(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_lat_lng  (latitude, longitude),
    INDEX idx_rating   (rating),
    INDEX idx_cuisine  (cuisine_id)
) ENGINE=InnoDB;

-- ============================================================
-- Graph nodes for Dijkstra routing
-- (intersections / waypoints on the map)
-- ============================================================
CREATE TABLE IF NOT EXISTS graph_nodes (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label      VARCHAR(80)   NOT NULL DEFAULT '',
    latitude   DECIMAL(10,7) NOT NULL,
    longitude  DECIMAL(10,7) NOT NULL,
    INDEX idx_node_latlong (latitude, longitude)
) ENGINE=InnoDB;

-- ============================================================
-- Graph edges (bidirectional roads / paths)
-- Weight = distance in metres (Haversine pre-computed)
-- ============================================================
CREATE TABLE IF NOT EXISTS graph_edges (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    node_from  INT UNSIGNED  NOT NULL,
    node_to    INT UNSIGNED  NOT NULL,
    weight     FLOAT         NOT NULL COMMENT 'distance in metres',
    road_name  VARCHAR(80)   NOT NULL DEFAULT '',
    CONSTRAINT fk_edge_from FOREIGN KEY (node_from)
        REFERENCES graph_nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_edge_to   FOREIGN KEY (node_to)
        REFERENCES graph_nodes(id) ON DELETE CASCADE,
    INDEX idx_from (node_from),
    INDEX idx_to   (node_to)
) ENGINE=InnoDB;

-- ============================================================
-- Restaurant ↔ nearest graph node mapping
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_nodes (
    restaurant_id INT UNSIGNED NOT NULL,
    node_id       INT UNSIGNED NOT NULL,
    PRIMARY KEY (restaurant_id),
    CONSTRAINT fk_rn_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_rn_node       FOREIGN KEY (node_id)
        REFERENCES graph_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB;
