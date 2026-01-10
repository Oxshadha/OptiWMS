#!/bin/bash

#############################################
# Generate All AI Training Data
# OptiWMS - Complete AI Data Generation
#############################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                               ║${NC}"
echo -e "${BLUE}║          AI Training Data Generation - Complete Suite         ║${NC}"
echo -e "${BLUE}║          OptiWMS - Sri Lankan Warehouse Context               ║${NC}"
echo -e "${BLUE}║                                                               ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python 3 found: $(python3 --version)${NC}"
echo ""

# Check dependencies
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
if ! python3 -c "import pandas" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installing pandas and numpy...${NC}"
    pip3 install pandas numpy
fi
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Step 1: Generate basic demand data if not exists
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 1: Checking base synthetic data...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if [ ! -f "../synthetic_data/demand_history_2023_2024.csv" ]; then
    echo -e "${YELLOW}⚠️  Base demand data not found. Generating...${NC}"
    python3 synthetic_data_generator.py
else
    echo -e "${GREEN}✅ Base demand data exists${NC}"
fi
echo ""

# Step 2: Generate material dimensions
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 2: Generating Material Dimensions...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
python3 generate_material_dimensions.py
echo ""

# Step 3: Generate ABC/FMS classifications
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 3: Generating ABC/FMS Classifications...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
python3 generate_abc_fms_classification.py
echo ""

# Step 4: Generate location coordinates
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 4: Generating Location Coordinates...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
python3 generate_location_coordinates.py
echo ""

# Step 5: Generate multi-item orders
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 5: Generating Multi-Item Orders...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
python3 generate_multi_item_orders.py
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ AI Training Data Generation Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📁 Generated Files in backend/synthetic_data/:${NC}"
echo ""
echo -e "  ${GREEN}Basic Data:${NC}"
echo -e "    • demand_history_2023_2024.csv"
echo -e "    • stock_movements_2023_2024.csv"
echo -e "    • inventory_snapshots_2023_2024.csv"
echo -e "    • orders_history_2023_2024.csv"
echo ""
echo -e "  ${GREEN}Material Properties:${NC}"
echo -e "    • material_dimensions.csv (length, width, height, weight, pallets)"
echo ""
echo -e "  ${GREEN}Classifications:${NC}"
echo -e "    • abc_classification.csv (Pareto analysis)"
echo -e "    • fms_classification.csv (Movement frequency)"
echo -e "    • abc_fms_amalgamated.csv (Combined with storage zones)"
echo ""
echo -e "  ${GREEN}Location Data:${NC}"
echo -e "    • location_coordinates.csv (X, Y, Z coordinates)"
echo -e "    • location_distance_matrix.csv (Distance matrix for pathfinding)"
echo -e "    • warehouse_waypoints.csv (Key waypoints)"
echo ""
echo -e "  ${GREEN}Order Data:${NC}"
echo -e "    • multi_item_orders_2023_2024.csv (Multi-item orders with locations)"
echo -e "    • order_summary.csv (Order-level summary)"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🤖 AI Services Ready For:${NC}"
echo ""
echo -e "  ${GREEN}✅ Genetic Algorithm (GA) - Optimal Storage${NC}"
echo -e "     → material_dimensions.csv"
echo -e "     → abc_fms_amalgamated.csv"
echo -e "     → location_coordinates.csv"
echo ""
echo -e "  ${GREEN}✅ TSP / A* - Optimal Picking Paths${NC}"
echo -e "     → multi_item_orders_2023_2024.csv"
echo -e "     → location_distance_matrix.csv"
echo -e "     → warehouse_waypoints.csv"
echo ""
echo -e "  ${GREEN}✅ Demand Forecasting${NC}"
echo -e "     → demand_history_2023_2024.csv"
echo -e "     → abc_fms_amalgamated.csv"
echo ""
echo -e "  ${GREEN}✅ Inventory Optimization${NC}"
echo -e "     → stock_movements_2023_2024.csv"
echo -e "     → abc_fms_amalgamated.csv"
echo -e "     → material_dimensions.csv"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📖 Next Steps:${NC}"
echo ""
echo -e "  1. Review generated data in ${BLUE}backend/synthetic_data/${NC}"
echo -e "  2. Import to database (see SYNTHETIC_DATA_GUIDE.md)"
echo -e "  3. Implement AI services (PyGAD, A*, Prophet)"
echo -e "  4. Train and test algorithms"
echo ""
echo -e "${GREEN}🎉 All AI training data ready!${NC}"
echo ""
