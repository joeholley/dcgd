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

# Optional Pub/Sub import with fallback
try:
    from google.cloud import pubsub_v1
    PUBSUB_AVAILABLE = True
except ImportError:
    PUBSUB_AVAILABLE = False


class TelemetrySimulator:
    """
    Simulates live game telemetry ticks, CCU fluctuations, and LiveOps anomalies.
    """

    EVENT_TYPES = [
        "session_start",
        "match_start",
        "level_fail",
        "boss_encounter",
        "boss_death",
        "iap_attempt",
        "toxic_chat"
    ]

    ANOMALIES = [
        "level_2_bottleneck",
        "high_churn_boss_deaths",
        "toxic_chat"
    ]

    def __init__(self, project_id=None, topic_name=None, rate_hz=10, active_anomaly="high_churn_boss_deaths"):
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT", "gaming-demo")
        self.topic_name = topic_name or os.environ.get("PUBSUB_TOPIC", "gaming-live-telemetry")
        self.rate_hz = rate_hz
        self.active_anomaly = active_anomaly
        self.publisher = None
        self.topic_path = None
        self.total_events_published = 0

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

    def calculate_ccu(self, t_seconds=None):
        """
        Generates a sinusoidal 24-hour CCU curve (1,200 to 18,500 CCU).
        Formula: current_ccu = int(1200 + 17300 * (sin(pi * t / 86400) ** 2))
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
        Generates a single telemetry tick payload, adjusted for active anomalies.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        current_ccu = self.calculate_ccu()
        player_id = f"player_{random.randint(1000, 9999)}"
        session_id = f"sess_{int(time.time() * 1000)}_{random.randint(100, 999)}"

        # Default event distribution
        event_type = random.choices(
            self.EVENT_TYPES,
            weights=[0.25, 0.25, 0.15, 0.15, 0.10, 0.05, 0.05]
        )[0]

        level = random.randint(1, 10)
        consecutive_deaths = random.choices([0, 1, 2, 3, 4, 5], weights=[0.5, 0.25, 0.12, 0.08, 0.03, 0.02])[0]
        session_duration = random.randint(30, 3600)
        toxicity_score = round(random.uniform(0.0, 0.2), 2)
        iap_amount = None

        # Apply LiveOps Anomaly Modifications
        if self.active_anomaly == "level_2_bottleneck":
            if random.random() < 0.70:
                event_type = "level_fail"
                level = 2
                consecutive_deaths = random.randint(2, 5)

        elif self.active_anomaly == "high_churn_boss_deaths":
            if random.random() < 0.80:
                event_type = random.choice(["boss_death", "level_fail"])
                consecutive_deaths = random.randint(3, 6)
                session_duration = random.randint(600, 4800)

        elif self.active_anomaly == "toxic_chat":
            if random.random() < 0.75:
                event_type = "toxic_chat"
                toxicity_score = round(random.uniform(0.75, 0.99), 2)

        if event_type == "iap_attempt":
            iap_amount = random.choice([0.99, 4.99, 9.99, 19.99, 49.99])

        payload = {
            "session_id": session_id,
            "player_id": player_id,
            "event_type": event_type,
            "level": level,
            "consecutive_deaths": consecutive_deaths,
            "session_duration_seconds": session_duration,
            "current_ccu": current_ccu,
            "active_anomaly": self.active_anomaly,
            "timestamp": now_iso,
        }

        if event_type == "toxic_chat":
            payload["toxicity_score"] = toxicity_score
            payload["chat_message"] = random.choice([
                "gg noob team", "uninstall game please", "cheater reported", "clown play"
            ])
        elif event_type == "iap_attempt":
            payload["iap_amount"] = iap_amount
            payload["sku"] = random.choice(["frost_giant_shield_pack", "gold_battlepass", "starter_pack_gold"])

        return payload

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
                print(f"[{dest}] #{self.total_events_published} | {event['event_type']} | CCU: {event['current_ccu']} | Player: {event['player_id']}")

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
