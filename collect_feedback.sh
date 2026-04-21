#!/bin/bash
# Feedback collection script for OptiWMS shadow mode
# Collects forecast vs actual performance data

echo "$(date): Starting feedback collection..."

# Run shadow feedback evaluator
python3 /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/scripts/shadow_feedback_evaluator.py \
  --forecast-db-url sqlite:////Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/evidence/forecast_service_live_snapshot.db \
  --wms-db-url postgresql://optiwms:optiwms@localhost:5434/optiwms \
  --schema public \
  --dataset B \
  --model-name CATBOOST \
  --outbound-statuses delivered,packed,picking,shipped,completed \
  --forecast-base-url http://localhost:8091 \
  --inference-window 200 \
  --out-dir /Users/k.e.oshada/Documents/OptiWMS/ai-services/forecast-service/artifacts/evidence

echo "$(date): Feedback collection completed"