#!/bin/bash

#############################################
# Synthetic Data Generation Script
# OptiWMS - Sri Lankan Warehouse Context
#############################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}OptiWMS Synthetic Data Generator${NC}"
echo -e "${BLUE}Sri Lankan Warehouse Context${NC}"
echo -e "${BLUE}============================================================${NC}"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python 3 found: $(python3 --version)${NC}"

# Check if required packages are installed
echo ""
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
if ! python3 -c "import pandas" &> /dev/null; then
    echo -e "${YELLOW}⚠️  pandas not found. Installing...${NC}"
    pip3 install pandas numpy
else
    echo -e "${GREEN}✅ pandas installed${NC}"
fi

if ! python3 -c "import numpy" &> /dev/null; then
    echo -e "${YELLOW}⚠️  numpy not found. Installing...${NC}"
    pip3 install numpy
else
    echo -e "${GREEN}✅ numpy installed${NC}"
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Default parameters
MONTHS=24
INPUT_DIR="../../frontend/Database Documents"
OUTPUT_DIR="../synthetic_data"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --months)
            MONTHS="$2"
            shift 2
            ;;
        --input)
            INPUT_DIR="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --help)
            echo ""
            echo "Usage: ./generate_data.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --months N      Number of months to generate (default: 24)"
            echo "  --input DIR     Input directory with CSV files (default: ../../frontend/Database Documents)"
            echo "  --output DIR    Output directory for generated data (default: ../synthetic_data)"
            echo "  --help          Show this help message"
            echo ""
            echo "Example:"
            echo "  ./generate_data.sh --months 36 --output ../synthetic_data_36m"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Months: ${YELLOW}$MONTHS${NC}"
echo -e "  Input:  ${YELLOW}$INPUT_DIR${NC}"
echo -e "  Output: ${YELLOW}$OUTPUT_DIR${NC}"
echo ""

# Check if input files exist
if [ ! -f "$INPUT_DIR/Item code and descriptions.csv" ]; then
    echo -e "${RED}❌ Input file not found: $INPUT_DIR/Item code and descriptions.csv${NC}"
    exit 1
fi

if [ ! -f "$INPUT_DIR/Active stock.csv" ]; then
    echo -e "${RED}❌ Input file not found: $INPUT_DIR/Active stock.csv${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Input files found${NC}"
echo ""

# Run the generator
echo -e "${BLUE}🚀 Starting data generation...${NC}"
echo ""

# Modify the generator to use custom months if needed
if [ "$MONTHS" != "24" ]; then
    # Create a temporary modified version
    sed "s/generator.generate_demand_history(months=24)/generator.generate_demand_history(months=$MONTHS)/" synthetic_data_generator.py > temp_generator.py
    python3 temp_generator.py "$INPUT_DIR" "$OUTPUT_DIR"
    rm temp_generator.py
else
    python3 synthetic_data_generator.py "$INPUT_DIR" "$OUTPUT_DIR"
fi

# Check if generation was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Data generation completed successfully!${NC}"
    echo ""
    
    # Run validation
    echo -e "${BLUE}🔍 Running data validation...${NC}"
    echo ""
    python3 data_validator.py "$OUTPUT_DIR"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Validation completed!${NC}"
        echo ""
        echo -e "${BLUE}============================================================${NC}"
        echo -e "${GREEN}📁 Generated files:${NC}"
        ls -lh "$OUTPUT_DIR"/*.csv "$OUTPUT_DIR"/*.json
        echo -e "${BLUE}============================================================${NC}"
        echo ""
        echo -e "${GREEN}🎉 Success! Your synthetic data is ready.${NC}"
        echo ""
        echo -e "${YELLOW}Next steps:${NC}"
        echo -e "  1. Import to database: See ${BLUE}SYNTHETIC_DATA_GUIDE.md${NC}"
        echo -e "  2. View in pgAdmin: http://localhost:5050"
        echo -e "  3. Train AI models: Use the generated CSV files"
        echo ""
    else
        echo -e "${YELLOW}⚠️  Validation completed with warnings. Check validation_results.json${NC}"
    fi
else
    echo ""
    echo -e "${RED}❌ Data generation failed. Check the error messages above.${NC}"
    exit 1
fi
