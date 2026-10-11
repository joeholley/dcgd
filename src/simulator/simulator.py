#!/usr/bin/env python3
"""
OmniArcade Live Game & Telemetry Simulator Microservice
Generates real-time player telemetry, CCU curves, and LiveOps anomalies.
Supports GCP Cloud Pub/Sub topic publishing with local fallback.
"""

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone

# Optional Pub/Sub and BigQuery imports with fallback
try:
    from google.cloud import pubsub_v1
    PUBSUB_AVAILABLE = True
except ImportError:
    PUBSUB_AVAILABLE = False

try:
    from google.cloud import bigquery
    BQ_AVAILABLE = True
except ImportError:
    BQ_AVAILABLE = False


class TelemetrySimulator:
    """
    Simulates live game telemetry ticks, CCU fluctuations, and LiveOps anomalies.
    Emits CloudEvents v1.0 payloads wrapped in { event_envelope, ingestion_timestamp }
    for Pub/Sub subscription ingestion into gaming_raw.simulator_webapp_demo_raw_events.
    """

    ANOMALIES = [
        "none",
        "high_churn_boss_deaths",
        "ddos_latency_spike",
        "toxic_chat",
        "fraudulent_chargeback_wave"
    ]

    def __init__(self, project_id=None, topic_name=None, rate_hz=10, active_anomaly="high_churn_boss_deaths"):
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT", "gaming-demo")
        self.topic_name = topic_name or os.environ.get("PUBSUB_TOPIC", "gaming-live-telemetry")
        self.rate_hz = rate_hz
        self.active_anomaly = active_anomaly
        self.publisher = None
        self.topic_path = None
        self.total_events_published = 0
        self.player_sample_pool = self._load_random_player_sample()

        if PUBSUB_AVAILABLE:
            try:
                self.publisher = pubsub_v1.PublisherClient()
                self.topic_path = self.publisher.topic_path(self.project_id, self.topic_name)
                print(f"[Simulator] Initialized Pub/Sub publisher for topic: {self.topic_path}")
            except Exception as e:
                print(f"[Simulator] Pub/Sub initialization failed: {e}. Falling back to stdout logging.")
                self.publisher = None
        else:
            print("[Simulator] google-cloud-pubsub not installed. Operating in local stdout fallback mode.")

    def _load_random_player_sample(self):
        """
        Fetches a random 50-player sample across all cohorts from player_dna via ORDER BY RAND() LIMIT 50,
        or generates a fallback 50-player sample with authentic UUIDv4 telemetry_guids.
        """
        player_dna_table = os.environ.get("SOURCE_PLAYER_DNA_TABLE", "gaming_player_data.player_dna")
        raw_events_table = os.environ.get("SOURCE_RAW_EVENTS_TABLE", "gaming_raw.raw_events")
        if BQ_AVAILABLE:
            try:
                bq_client = bigquery.Client(project=self.project_id)
                sql = f"""
                    WITH active_players_today AS (
                      SELECT DISTINCT
                        COALESCE(
                          JSON_VALUE(event_envelope, '$.subject'),
                          JSON_VALUE(event_envelope, '$.data.player_id')
                        ) AS active_id
                      FROM `{raw_events_table}`
                      WHERE DATE(TIMESTAMP(JSON_VALUE(event_envelope, '$.time'))) = CURRENT_DATE()
                    )
                    SELECT
                      CAST(p.player_id AS STRING) AS player_id,
                      CAST(p.telemetry_guid AS STRING) AS telemetry_guid,
                      COALESCE(CAST(p.device_id AS STRING), CONCAT('dev-hw-', SUBSTR(CAST(p.telemetry_guid AS STRING), 1, 8))) AS device_id,
                      COALESCE(CAST(p.platform AS STRING), 'PC_STEAM') AS platform,
                      COALESCE(CAST(p.country AS STRING), 'US') AS region,
                      COALESCE(CAST(p.monetization_tier AS STRING), 'Dolphin') AS monetization_tier
                    FROM `{player_dna_table}` p
                    LEFT JOIN active_players_today a
                      ON CAST(p.telemetry_guid AS STRING) = a.active_id
                      OR CAST(p.player_id AS STRING) = a.active_id
                    WHERE p.telemetry_guid IS NOT NULL
                    ORDER BY
                      CASE WHEN a.active_id IS NULL THEN 0 ELSE 1 END ASC,
                      RAND()
                    LIMIT 50
                """
                rows = list(bq_client.query(sql).result(timeout=5.0))
                if rows:
                    pool = [
                        {
                            "player_id": r.player_id or f"PLAY-000{idx+1:02d}",
                            "telemetry_guid": r.telemetry_guid or f"550e8400-e29b-41d4-a716-44665544{idx+1:04x}",
                            "device_id": r.device_id or f"dev-hw-{idx+1:04x}",
                            "platform": r.platform or "PC_STEAM",
                            "region": r.region or "NA-EAST",
                            "monetization_tier": r.monetization_tier or "Dolphin",
                        }
                        for idx, r in enumerate(rows)
                    ]
                    print(f"[Simulator] Loaded {len(pool)} random players from {player_dna_table}")
                    return pool
            except Exception as e:
                print(f"[Simulator] BigQuery RAND() sample fallback ({e}). Generating 50 random fallback players.")

        tiers = ["Whale", "Dolphin", "Minnow", "F2P"]
        platforms = ["PC_STEAM", "PS5", "XBOX_SERIES_X", "MOBILE_IOS", "MOBILE_ANDROID"]
        regions = ["NA-EAST", "EU-WEST", "APAC-EAST", "LATAM"]
        seed_offset = random.randint(1000, 8999)
        return [
            {
                "player_id": f"PLAY-00{seed_offset + i}",
                "telemetry_guid": f"550e8400-e29b-41d4-a716-44665544{seed_offset + i:04x}",
                "device_id": f"dev-hw-{seed_offset + i:04x}-{random.randint(100000, 999999)}",
                "platform": random.choice(platforms),
                "region": random.choice(regions),
                "monetization_tier": random.choice(tiers),
            }
            for i in range(50)
        ]

    def calculate_ccu(self, t_seconds=None):
        """
        Generates a sinusoidal 24-hour CCU curve (1,200 to 18,500 CCU).
        """
        if t_seconds is None:
            now = datetime.now(timezone.utc)
            t_seconds = (now.hour * 3600 + now.minute * 60 + now.second) % 86400

        sin_val = math.sin(math.pi * t_seconds / 86400.0)
        return int(1200 + 17300 * (sin_val ** 2))

    def set_anomaly(self, anomaly_type):
        if anomaly_type and anomaly_type not in self.ANOMALIES:
            print(f"[Simulator] Warning: Unknown anomaly type '{anomaly_type}'. Resetting anomaly.")
            self.active_anomaly = None
        else:
            self.active_anomaly = anomaly_type
            print(f"[Simulator] Active anomaly set to: {self.active_anomaly}")

    def generate_event(self):
        """
        Generates a single CloudEvents v1.0 telemetry payload wrapped for simulator_webapp_demo_raw_events.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        current_ccu = self.calculate_ccu()
        player = random.choice(self.player_sample_pool)
        session_id = f"sess_{int(time.time() * 1000)}_{random.randint(100, 999)}"

        cloud_event_type = "com.gamestudio.gameplay.match_ended"
        level_id = "level_01"
        outcome = "VICTORY"
        deaths = random.choice([0, 1])
        duration_seconds = random.randint(180, 1200)
        boss_damage_pct = 1.0
        xp_earned = random.randint(250, 600)
        boss_id = None

        if self.active_anomaly == "high_churn_boss_deaths":
            level_id = "level_02"
            boss_id = "frost_giant_boss"
            outcome = "DEFEAT"
            deaths = random.randint(3, 6)
            duration_seconds = random.randint(600, 2400)
            boss_damage_pct = round(random.uniform(0.55, 0.92), 2)
            xp_earned = random.randint(40, 150)

        event_envelope = {
            "specversion": "1.0",
            "id": f"evt_{int(time.time() * 1000)}_{random.randint(1000, 9999)}",
            "source": "urn:uuid:73f9b2d1-a8e4-4c3b-9e12-f6d8c4b2a101",
            "type": cloud_event_type,
            "subject": player["telemetry_guid"],
            "time": now_iso,
            "datacontenttype": "application/json",
            "data": {
                "session_id": session_id,
                "player_id": player["player_id"],
                "device_id": player["device_id"],
                "platform": player["platform"],
                "region": player["region"],
                "monetization_tier": player["monetization_tier"],
                "level_id": level_id,
                **({"boss_id": boss_id} if boss_id else {}),
                "outcome": outcome,
                "deaths": deaths,
                "duration_seconds": duration_seconds,
                "boss_damage_pct": boss_damage_pct,
                "xp_earned": xp_earned,
                "current_ccu": current_ccu,
                "active_anomaly": self.active_anomaly,
            },
        }

        return {
            "event_envelope": event_envelope,
            "ingestion_timestamp": now_iso,
        }

    def publish_event(self, event):
        """
        Publishes an event to GCP Pub/Sub or falls back to stdout.
        """
        data_str = json.dumps(event)
        published = False

        if self.publisher and self.topic_path:
            try:
                data_bytes = data_str.encode("utf-8")
                future = self.publisher.publish(self.topic_path, data_bytes)
                future.result(timeout=2.0)
                published = True
            except Exception as e:
                print(f"[Simulator] Pub/Sub publish failed ({e}). Disabling Pub/Sub for subsequent ticks (falling back to stdout).")
                self.publisher = None
                published = False

        self.total_events_published += 1
        return published

    def run(self, duration_sec=None):
        """
        Runs the simulation loop at the specified rate_hz.
        """
        interval = 1.0 / self.rate_hz if self.rate_hz > 0 else 0.1
        start_time = time.time()
        print(f"[Simulator] Running telemetry generator at {self.rate_hz} Hz...")
        print(f"[Simulator] Current CCU: {self.calculate_ccu()}")
        if self.active_anomaly:
            print(f"[Simulator] Active Anomaly: {self.active_anomaly}")

        try:
            while True:
                if duration_sec and (time.time() - start_time) >= duration_sec:
                    break

                event = self.generate_event()
                pub_success = self.publish_event(event)
                dest = "Pub/Sub" if pub_success else "stdout/local"
                env = event["event_envelope"]
                data = env["data"]
                print(f"[{dest}] #{self.total_events_published} | {env['type']} ({data['outcome']}, deaths={data['deaths']}) | Player: {data['player_id']} ({env['subject'][:8]}...)")

                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[Simulator] Simulation stopped by user.")


def main():
    parser = argparse.ArgumentParser(description="OmniArcade Telemetry & CCU Simulator")
    parser.add_argument("--rate", type=float, default=10.0, help="Event generation rate in Hz (events/sec)")
    parser.add_argument("--project", type=str, default=None, help="GCP Project ID")
    parser.add_argument("--topic", type=str, default="gaming-live-telemetry", help="GCP Pub/Sub topic name")
    parser.add_argument("--anomaly", type=str, choices=TelemetrySimulator.ANOMALIES, default="high_churn_boss_deaths", help="Inject LiveOps anomaly")
    parser.add_argument("--duration", type=float, default=None, help="Run duration in seconds (default: infinite)")

    args = parser.parse_args()

    simulator = TelemetrySimulator(
        project_id=args.project,
        topic_name=args.topic,
        rate_hz=args.rate,
        active_anomaly=args.anomaly
    )
    simulator.run(duration_sec=args.duration)


if __name__ == "__main__":
    main()
