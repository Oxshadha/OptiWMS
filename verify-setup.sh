#!/bin/bash

echo "=== OptiWMS Setup Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check Java
echo "1. Checking Java..."
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | sed '/^1\./s///' | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge 21 ]; then
        echo -e "${GREEN}✓ Java $JAVA_VERSION found${NC}"
    else
        echo -e "${RED}✗ Java 21+ required, found version $JAVA_VERSION${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ Java not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js
echo "2. Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"
    else
        echo -e "${RED}✗ Node.js 20+ required, found $(node -v)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker
echo "3. Checking Docker..."
if command -v docker &> /dev/null; then
    if docker ps &> /dev/null; then
        echo -e "${GREEN}✓ Docker is running${NC}"
    else
        echo -e "${YELLOW}⚠ Docker installed but not running${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Docker not found (optional, but recommended)${NC}"
fi

# Check Gradle Wrapper
echo "4. Checking Gradle Wrapper..."
if [ -f "backend/gradlew" ]; then
    if [ -x "backend/gradlew" ]; then
        echo -e "${GREEN}✓ Gradle wrapper found and executable${NC}"
    else
        echo -e "${YELLOW}⚠ Gradle wrapper found but not executable, fixing...${NC}"
        chmod +x backend/gradlew
        echo -e "${GREEN}✓ Fixed${NC}"
    fi
else
    echo -e "${RED}✗ Gradle wrapper not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Dockerfiles
echo "5. Checking Dockerfiles..."
if [ -f "backend/Dockerfile" ] && [ -f "frontend/Dockerfile" ]; then
    echo -e "${GREEN}✓ Dockerfiles found${NC}"
else
    echo -e "${RED}✗ Dockerfiles missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check docker-compose
echo "6. Checking Docker Compose..."
if [ -f "infra/docker-compose.yml" ]; then
    echo -e "${GREEN}✓ docker-compose.yml found${NC}"
else
    echo -e "${RED}✗ docker-compose.yml not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check setup guides
echo "7. Checking Setup Guides..."
if [ -f "SETUP_GUIDE.md" ] && [ -f "QUICK_START.md" ]; then
    echo -e "${GREEN}✓ Setup guides found${NC}"
else
    echo -e "${YELLOW}⚠ Setup guides missing${NC}"
fi

# Check application configs
echo "8. Checking Application Configs..."
if [ -f "backend/core-api/src/main/resources/application.yml" ]; then
    echo -e "${GREEN}✓ application.yml found${NC}"
else
    echo -e "${RED}✗ application.yml not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}=== All checks passed! Ready to push. ===${NC}"
    exit 0
else
    echo -e "${RED}=== Found $ERRORS error(s). Please fix before pushing. ===${NC}"
    exit 1
fi

