#!/usr/bin/env bash
# OptiWMS End-to-End Smoke Test
# Run from project root: ./scripts/smoke_test.sh

set -e
echo "=== OptiWMS E2E Smoke Test ==="
echo ""

# 1. Check generated data files
echo "--- Phase 1: Data Generation Artifacts ---"
GENERATED_DIR="Ai miroservices/modeling/outputs/generated"

for f in "rule_based_portable_monthly.csv" "rule_based_wms_monthly.csv" \
         "product_dimensions.csv" "bom_clean.csv" "bom_seed.sql" \
         "rack_locations.csv" "rack_level_specs.csv" "storage_type_capacity_matrix.csv" \
         "warehouse_quantile_forecasts.csv" "rm_gross_requirements.csv" "rm_inventory_policy.csv"; do
    if [ -f "$GENERATED_DIR/$f" ]; then
        ROWS=$(wc -l < "$GENERATED_DIR/$f" | tr -d ' ')
        echo "  OK: $f ($ROWS lines)"
    else
        echo "  MISSING: $f (run generators first)"
    fi
done

# 2. Check MLflow comparison output
echo ""
echo "--- Phase 2: MLflow Comparison ---"
COMPARISON="Ai miroservices/modeling/mlflow_comparison/outputs/ml_vs_stat_comparison.csv"
if [ -f "$COMPARISON" ]; then
    echo "  OK: ml_vs_stat_comparison.csv"
else
    echo "  MISSING: Run mlflow_m5_comparison.py first"
fi

# 3. Check merge conflicts resolved
echo ""
echo "--- Phase 3: Merge Conflicts ---"
CONFLICTS=$(grep -rl "^<<<<<<<" ai_services/slotting-service/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$CONFLICTS" = "0" ]; then
    echo "  OK: No merge conflicts in slotting-service"
else
    echo "  ERROR: $CONFLICTS files with merge conflicts"
fi

# 4. Check infrastructure files
echo ""
echo "--- Phase 4: Infrastructure ---"
for f in "infra/docker-compose.mlops.yml" \
         "ai_services/shared/kafka_client.py" \
         "backend/infra/src/main/resources/db/migration/V60__add_product_dimensions_and_forecast.sql" \
         "backend/infra/src/main/resources/db/migration/V61__create_forecast_results_table.sql" \
         "backend/scripts/seed_generated_data.py"; do
    if [ -f "$f" ]; then
        echo "  OK: $f"
    else
        echo "  MISSING: $f"
    fi
done

# 5. Check key service files
echo ""
echo "--- Phase 5: Service Files ---"
for f in "ai_services/slotting-service/app/api/config.py" \
         "ai_services/slotting-service/app/api/fitness.py" \
         "ai_services/slotting-service/app/api/endpoints.py" \
         "ai_services/slotting-service/app/models/schemas.py" \
         "ai_services/slotting-service/app/models/db_models.py"; do
    if [ -f "$f" ]; then
        echo "  OK: $f"
    else
        echo "  MISSING: $f"
    fi
done

echo ""
echo "=== Smoke Test Complete ==="
echo ""
echo "To run the full pipeline:"
echo "  1. Generate data:  cd 'Ai miroservices/modeling/v1_legacy/scripts' && python rule_based_synthetic_generator.py"
echo "  2. Generate dims:  python generate_product_dimensions.py"
echo "  3. Generate BOM:   python generate_bom_clean.py"
echo "  4. Generate racks: python generate_rack_specs.py"
echo "  5. Start infra:    cd infra && docker compose -f docker-compose.yml -f docker-compose.mlops.yml up -d"
echo "  6. Run forecasts:  cd 'Ai miroservices/modeling/mlflow_comparison' && python warehouse_forecast_pipeline.py"
echo "  7. Run BOM explode: python bom_explosion_pipeline.py"
echo "  8. Run ML vs Stat:  python mlflow_m5_comparison.py"
echo "  9. Seed DB:         cd backend/scripts && python seed_generated_data.py"
echo " 10. Start services:  cd ai_services && docker compose -f docker-compose.ai.yml up -d"
