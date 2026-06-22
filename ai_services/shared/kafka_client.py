"""
Shared Kafka client for OptiWMS AI services.
Uses kafka-python for producer/consumer functionality.

Topics:
  - optiwms.forecast.requests   : Trigger forecast runs
  - optiwms.forecast.results    : Forecast output events
  - optiwms.slotting.requests   : Trigger GA optimization
  - optiwms.slotting.results    : Slotting output events
  - optiwms.classification.events : ABC/FMS classification updates
  - optiwms.inventory.alerts    : Reorder point / stockout alerts
  - optiwms.demand.updates      : New demand data ingestion events
"""
from __future__ import annotations

import json
import logging
import os
from typing import Callable

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:29092")
SERVICE_NAME = os.getenv("SERVICE_NAME", "unknown-service")


class KafkaProducerWrapper:
    def __init__(self, bootstrap_servers: str = KAFKA_BOOTSTRAP):
        self._producer = None
        self._bootstrap = bootstrap_servers

    def _ensure_producer(self):
        if self._producer is not None:
            return
        try:
            from kafka import KafkaProducer
            self._producer = KafkaProducer(
                bootstrap_servers=self._bootstrap,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
            )
            logger.info("Kafka producer connected: %s", self._bootstrap)
        except Exception as exc:
            logger.warning("Kafka producer unavailable: %s (events will be dropped)", exc)

    def send(self, topic: str, value: dict, key: str = None):
        self._ensure_producer()
        if self._producer is None:
            logger.debug("Kafka disabled — dropping event to %s", topic)
            return
        try:
            value["_source"] = SERVICE_NAME
            self._producer.send(topic, value=value, key=key)
            self._producer.flush()
        except Exception as exc:
            logger.error("Failed to send to %s: %s", topic, exc)

    def close(self):
        if self._producer:
            self._producer.close()


class KafkaConsumerWrapper:
    def __init__(self, topic: str, group_id: str, bootstrap_servers: str = KAFKA_BOOTSTRAP):
        self._topic = topic
        self._group_id = group_id
        self._bootstrap = bootstrap_servers
        self._consumer = None

    def _ensure_consumer(self):
        if self._consumer is not None:
            return
        try:
            from kafka import KafkaConsumer
            self._consumer = KafkaConsumer(
                self._topic,
                bootstrap_servers=self._bootstrap,
                group_id=self._group_id,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                consumer_timeout_ms=1000,
            )
            logger.info("Kafka consumer connected: %s -> %s", self._topic, self._group_id)
        except Exception as exc:
            logger.warning("Kafka consumer unavailable for %s: %s", self._topic, exc)

    def poll_once(self, handler: Callable[[dict], None]):
        self._ensure_consumer()
        if self._consumer is None:
            return
        try:
            for message in self._consumer:
                handler(message.value)
        except Exception as exc:
            logger.debug("Kafka poll: %s", exc)

    def close(self):
        if self._consumer:
            self._consumer.close()


TOPICS = {
    "FORECAST_REQUESTS": "optiwms.forecast.requests",
    "FORECAST_RESULTS": "optiwms.forecast.results",
    "SLOTTING_REQUESTS": "optiwms.slotting.requests",
    "SLOTTING_RESULTS": "optiwms.slotting.results",
    "CLASSIFICATION_EVENTS": "optiwms.classification.events",
    "INVENTORY_ALERTS": "optiwms.inventory.alerts",
    "DEMAND_UPDATES": "optiwms.demand.updates",
}


producer = KafkaProducerWrapper()


def emit_forecast_result(warehouse_id: str, model_name: str, n_series: int, wape: float):
    producer.send(TOPICS["FORECAST_RESULTS"], {
        "event": "forecast_completed",
        "warehouse_id": warehouse_id,
        "model_name": model_name,
        "n_series": n_series,
        "wape": wape,
    }, key=warehouse_id)


def emit_slotting_result(warehouse_id: str, n_assignments: int, best_fitness: float):
    producer.send(TOPICS["SLOTTING_RESULTS"], {
        "event": "slotting_completed",
        "warehouse_id": warehouse_id,
        "n_assignments": n_assignments,
        "best_fitness": best_fitness,
    }, key=warehouse_id)


def emit_classification_event(warehouse_id: str, material_code: str, abc: str, fms: str):
    producer.send(TOPICS["CLASSIFICATION_EVENTS"], {
        "event": "classification_updated",
        "warehouse_id": warehouse_id,
        "material_code": material_code,
        "abc_class": abc,
        "fms_class": fms,
    }, key=material_code)


def emit_inventory_alert(warehouse_id: str, material_code: str, alert_type: str, details: dict):
    producer.send(TOPICS["INVENTORY_ALERTS"], {
        "event": "inventory_alert",
        "warehouse_id": warehouse_id,
        "material_code": material_code,
        "alert_type": alert_type,
        **details,
    }, key=material_code)


def emit_demand_update(warehouse_id: str, material_code: str, period: str, demand_units: float):
    producer.send(TOPICS["DEMAND_UPDATES"], {
        "event": "demand_recorded",
        "warehouse_id": warehouse_id,
        "material_code": material_code,
        "period": period,
        "demand_units": demand_units,
    }, key=material_code)
