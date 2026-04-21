#!/bin/bash
# Shadow forecast runner for OptiWMS
# Runs forecast for dataset B with CATBOOST model in shadow mode

echo "$(date): Starting shadow forecast run..."

# Run forecast via orchestrator
response=$(curl -s -X POST "http://localhost:8092/jobs/forecast-run?dataset=B&model_name=CATBOOST&mode=auto")

# Check if successful
if echo "$response" | jq -e '.run_state.status == "published"' > /dev/null; then
    run_id=$(echo "$response" | jq -r '.run_id')
    echo "$(date): Shadow forecast run $run_id completed successfully"
else
    echo "$(date): Shadow forecast run failed: $response"
    exit 1
fi

echo "$(date): Shadow forecast run completed"