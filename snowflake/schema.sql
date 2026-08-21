-- Parsel × Snowflake: the durable evidence / feature / forecast / audit layer.
--
-- Design constraints (per the integration plan):
--   * Store normalized public data, inventory movements, donations,
--     distributions, and AGGREGATE reviewed drone observations only.
--   * No raw drone video or individual detections. Snowflake never controls the
--     drone.
--   * The existing Python hotspot model stays the source of forecasts; it reads
--     ZONE_FEATURE and writes a new HOTSPOT_FORECAST_VERSION per update.
--   * Regular API inserts (no Snowpipe Streaming yet).
--
-- Run top-to-bottom in a Snowflake worksheet (creates its own PARSEL_WH warehouse).

CREATE WAREHOUSE IF NOT EXISTS PARSEL_WH
  WITH WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE;
CREATE DATABASE IF NOT EXISTS PARSEL;
CREATE SCHEMA IF NOT EXISTS PARSEL.CORE;
USE WAREHOUSE PARSEL_WH;
USE SCHEMA PARSEL.CORE;

-- ---------------------------------------------------------------------------
-- Dimensions
-- ---------------------------------------------------------------------------

-- Delivery/need zones (the six downtown neighborhoods + any custom drops).
CREATE TABLE IF NOT EXISTS ZONE (
  zone_id       STRING        PRIMARY KEY,          -- e.g. 'east_village'
  name          STRING        NOT NULL,             -- 'East Village'
  neighborhood  STRING,
  lat           FLOAT,
  lng           FLOAT,
  elevation_m   FLOAT,
  is_custom     BOOLEAN       DEFAULT FALSE
);

-- ---------------------------------------------------------------------------
-- Normalized public datasets (tidy long format: one metric value per row)
--   sources: DSDP counts, 311 "Get It Done", HUD PIT, SDHC shelters,
--            paid parking (Source J), USDA FARA (Source I), terrain.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS SIGNAL_OBSERVATION (
  source        STRING        NOT NULL,             -- 'dsdp', 'gid_311', 'hud_pit', ...
  geography     STRING        NOT NULL,             -- zone_id, 'san_diego_region', 'la_jolla'
  metric        STRING        NOT NULL,             -- 'dsdp_individuals', 'gid_requests', ...
  obs_month     DATE          NOT NULL,             -- first of month (or vintage date)
  value         FLOAT,
  ingested_at   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------------
-- Inventory movements + donations + distributions (the warehouse ledger)
-- ---------------------------------------------------------------------------

-- One row per stock change. kind ties a movement back to its source record.
CREATE TABLE IF NOT EXISTS INVENTORY_MOVEMENT (
  movement_id   STRING        PRIMARY KEY,
  occurred_at   TIMESTAMP_NTZ NOT NULL,
  item_name     STRING        NOT NULL,
  category      STRING,
  unit          STRING,
  delta_qty     NUMBER(12,2)  NOT NULL,             -- +in / -out
  kind          STRING        NOT NULL,             -- DONATION|DISTRIBUTION|ADJUST|SPOILAGE|REORDER
  ref_id        STRING                              -- donation_id / distribution_id when applicable
);

CREATE TABLE IF NOT EXISTS DONATION (
  donation_id   STRING        PRIMARY KEY,
  donated_at    TIMESTAMP_NTZ NOT NULL,
  donor_name    STRING,
  donor_type    STRING,                             -- individual|grocery|corporate|food-drive
  notes         STRING
);

CREATE TABLE IF NOT EXISTS DONATION_ITEM (
  donation_id   STRING        NOT NULL REFERENCES DONATION(donation_id),
  item_name     STRING        NOT NULL,
  category      STRING,
  quantity      NUMBER(12,2),
  unit          STRING
);

CREATE TABLE IF NOT EXISTS DISTRIBUTION (
  distribution_id   STRING        PRIMARY KEY,
  distributed_at    TIMESTAMP_NTZ NOT NULL,
  recipient         STRING,
  type              STRING,                         -- household|partner-agency|mobile-pantry
  zone_id           STRING        REFERENCES ZONE(zone_id),
  households_served NUMBER(10,0),
  notes             STRING
);

CREATE TABLE IF NOT EXISTS DISTRIBUTION_ITEM (
  distribution_id   STRING        NOT NULL REFERENCES DISTRIBUTION(distribution_id),
  item_name         STRING        NOT NULL,
  quantity          NUMBER(12,2),
  unit              STRING
);

-- ---------------------------------------------------------------------------
-- Reviewed drone evidence (AGGREGATE ONLY) — the human-in-the-loop signal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS DRONE_OBSERVATION (
  observation_id  STRING        PRIMARY KEY,
  observed_at     TIMESTAMP_NTZ NOT NULL,
  zone_id         STRING        NOT NULL REFERENCES ZONE(zone_id),
  observed_count  NUMBER(10,0)  NOT NULL,           -- reviewed aggregate person count
  confidence      FLOAT,                            -- 0..1
  ability         STRING,                           -- 'eyepop.common-objects:latest'
  model_version   STRING,                           -- hotspot model version this fed into
  operator        STRING,                           -- who approved it
  notes           STRING
);

-- ---------------------------------------------------------------------------
-- Versioned hotspot forecasts (the audit trail + before/after on the map)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS HOTSPOT_FORECAST_VERSION (
  version_id        STRING        PRIMARY KEY,       -- ULID/UUID from the model run
  created_at        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  model_name        STRING,                          -- 'stacked_hotspot_ensemble'
  trigger           STRING,                          -- SCHEDULED | OBSERVATION
  observation_id    STRING        REFERENCES DRONE_OBSERVATION(observation_id), -- if trigger=OBSERVATION
  parent_version_id STRING        REFERENCES HOTSPOT_FORECAST_VERSION(version_id),
  notes             STRING
);

-- One row per zone per version (the hotspot positions/scores for that version).
CREATE TABLE IF NOT EXISTS HOTSPOT_FORECAST (
  version_id      STRING        NOT NULL REFERENCES HOTSPOT_FORECAST_VERSION(version_id),
  zone_id         STRING        NOT NULL REFERENCES ZONE(zone_id),
  lat             FLOAT,
  lng             FLOAT,
  predicted_need  FLOAT,
  rank            NUMBER(5,0)
);

-- ---------------------------------------------------------------------------
-- ZONE_FEATURE — incremental feature table the Python model reads.
-- A Dynamic Table keeps it fresh automatically as the source rows change.
-- ---------------------------------------------------------------------------
CREATE DYNAMIC TABLE IF NOT EXISTS ZONE_FEATURE
  TARGET_LAG = '5 minutes'
  WAREHOUSE = PARSEL_WH
  AS
  WITH latest_signal AS (
    SELECT geography AS zone_id, metric, value,
           ROW_NUMBER() OVER (PARTITION BY geography, metric ORDER BY obs_month DESC) AS rn
    FROM SIGNAL_OBSERVATION
  ),
  pivoted AS (
    SELECT zone_id,
           MAX(CASE WHEN metric = 'dsdp_individuals' THEN value END) AS dsdp_individuals,
           MAX(CASE WHEN metric = 'gid_requests'     THEN value END) AS gid_requests,
           MAX(CASE WHEN metric = 'dsdp_tents'       THEN value END) AS tents,
           MAX(CASE WHEN metric = 'dsdp_vehicles'    THEN value END) AS vehicles
    FROM latest_signal WHERE rn = 1
    GROUP BY zone_id
  ),
  latest_obs AS (
    SELECT zone_id, observed_count, confidence, observed_at,
           ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY observed_at DESC) AS rn
    FROM DRONE_OBSERVATION
  )
  SELECT z.zone_id, z.name, z.lat, z.lng, z.elevation_m,
         p.dsdp_individuals, p.gid_requests, p.tents, p.vehicles,
         o.observed_count AS last_drone_count,
         o.confidence     AS last_drone_confidence,
         o.observed_at    AS last_drone_at
  FROM ZONE z
  LEFT JOIN pivoted p   ON p.zone_id = z.zone_id
  LEFT JOIN latest_obs o ON o.zone_id = z.zone_id AND o.rn = 1;

-- ---------------------------------------------------------------------------
-- Optional: scheduled forecast refresh. The Python model owns the actual
-- recompute; this Task is the schedule/trigger hook. Point it at your proc or
-- external function, or drive the run from the app after an observation insert.
-- ---------------------------------------------------------------------------
-- CREATE TASK REFRESH_HOTSPOT_FORECAST
--   WAREHOUSE = PARSEL_WH
--   SCHEDULE = '60 MINUTE'
-- AS
--   CALL RUN_HOTSPOT_MODEL();   -- Snowpark stored proc that writes a new version
-- ALTER TASK REFRESH_HOTSPOT_FORECAST RESUME;
