# Team Collaboration Guide: Forecast Feature

## 📋 **GitHub Files to Update for Team Access**

### ✅ **Files to Commit to GitHub (Safe to Share)**

#### **Code & Configuration**
```bash
# Core forecast service code
ai-services/forecast-service/app/
ai-services/forecast-service/pyproject.toml
ai-services/forecast-service/Dockerfile

# Orchestrator service
ai-services/orchestrator-service/app/
ai-services/orchestrator-service/pyproject.toml
ai-services/orchestrator-service/Dockerfile

# Docker compose (without secrets)
ai-services/docker-compose.ai.yml
infra/docker-compose.yml

# Scripts (automation scripts)
shadow_forecast.sh
collect_feedback.sh

# Documentation
DEPLOYMENT_CHANGELOG.md
ai-services/README.md
ai-services/FORECAST_GATEWAY_API_GUIDE.md
docs/forecasting-workflow-gap-assessment.md
docs/ai-microservices-implementation-brief.md
```

#### **Template Files**
```bash
# Environment template (safe to commit)
ai-services/.env.example

# Configuration templates
ai-services/docker-compose.ai.yml  # (with default values)
```

### ❌ **Files to Send Privately (NEVER Commit)**

#### **Sensitive Configuration**
```bash
# Environment files with real credentials
ai-services/.env
infra/.env

# Database files with sensitive data
forecast_service.db
ai-services/forecast-service/forecast_service.db
ai-services/forecast-service/artifacts/evidence/*.db
```

#### **Production Secrets**
```bash
# API keys, tokens, passwords
WMS_SERVICE_TOKEN=your_actual_token
DATABASE_URL=postgresql://user:password@host:port/db

# Webhook URLs
OPS_ALERT_WEBHOOK_URL=https://your-slack-webhook

# Private keys or certificates
```

### 🤔 **Dataset Files: Share or Not?**

#### **Current Dataset (B) - RECOMMENDATION: Share Limited**

**What to Share:**
- ✅ **Synthetic/Generated Data**: Safe to commit for reproducibility
- ✅ **Data Schemas**: Column definitions, data types
- ✅ **Sample Data**: Anonymized subsets for testing
- ✅ **Data Generation Scripts**: How data was created

**What NOT to Share:**
- ❌ **Production Customer Data**: Real customer information
- ❌ **Proprietary Business Data**: Actual sales figures, PII
- ❌ **Large Raw Datasets**: If they contain sensitive information

**Enterprise Best Practice:**
```bash
# Create data generation scripts instead
scripts/generate_synthetic_dataset.py  # ✅ Commit this
data/synthetic_dataset_B.csv           # ✅ Commit this

# Keep real data separate
data/production_dataset_B.csv          # ❌ Private/Share via secure channels
```

---

## 🏢 **Enterprise-Level Best Practices**

### **1. Repository Structure**
```
optiwms/
├── .github/
│   ├── workflows/          # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/     # Feature/bug templates
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                   # All documentation
├── scripts/               # Setup and utility scripts
├── infra/                 # Infrastructure as code
├── ai-services/          # AI microservices
├── backend/              # Core application
├── frontend/             # UI application
├── .gitignore           # Comprehensive ignore rules
└── README.md            # Setup and contribution guide
```

### **2. Branching Strategy**
```bash
# Main branches
main                    # Production-ready code
develop                # Integration branch

# Feature branches
feature/forecast-sku-mapping
feature/ai-governance
bugfix/latency-threshold

# Release branches
release/v1.0.0
```

### **3. CI/CD Pipeline**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run AI service tests
        run: |
          cd ai-services
          docker-compose up -d forecast-service
          docker-compose exec forecast-service pytest
```

### **4. Environment Management**
```bash
# Use different .env files for each environment
.env.development     # Local development
.env.staging        # Testing environment
.env.production     # Production (never committed)

# Load via docker-compose override
docker-compose -f docker-compose.yml -f docker-compose.production.yml up
```

### **5. Secret Management**
```bash
# Use GitHub Secrets for CI/CD
# Never hardcode secrets in code
# Use environment variables everywhere

# Example in code:
api_key = os.getenv('WMS_SERVICE_TOKEN')
if not api_key:
    raise ValueError("WMS_SERVICE_TOKEN not set")
```

### **6. Documentation Standards**
```markdown
# Every feature needs:
- README.md (setup instructions)
- API documentation
- Architecture diagrams
- Deployment guide
- Troubleshooting guide
```

### **7. Code Review Process**
```bash
# Pull Request Requirements:
- [ ] Tests pass
- [ ] Code coverage >80%
- [ ] Security scan passes
- [ ] Documentation updated
- [ ] Environment variables documented
- [ ] Migration scripts included
```

---

## 📤 **Sharing with Team Members**

### **Step 1: Prepare Repository**
```bash
# Ensure all safe files are committed
git add .
git commit -m "feat(forecast): Add forecast feature implementation"
git push origin forecastModel-oshadha
```

### **Step 2: Create Setup Documentation**
```bash
# Update README.md with setup instructions
echo "# Forecast Feature Setup

## Prerequisites
- Docker & Docker Compose
- Python 3.11+
- PostgreSQL (for WMS data)

## Quick Start
1. Clone repository
2. Copy .env.example to .env
3. Fill in your environment variables
4. docker-compose -f ai-services/docker-compose.ai.yml up

## Required Environment Variables
- WMS_API_BASE_URL
- WMS_SERVICE_TOKEN
- DATABASE_URL
" > ai-services/README.md
```

### **Step 3: Share Privately**
```bash
# Send these files via secure channels:
- .env file (with real credentials)
- forecast_service.db (if needed for testing)
- Any production datasets (encrypted)

# Use secure sharing methods:
- Company VPN
- Encrypted email
- Secure file sharing service
- Direct transfer (for large files)
```

### **Step 4: Team Onboarding**
```bash
# Create GitHub issue for onboarding
Title: "Onboard Team to Forecast Feature"

Description:
- [ ] Repository access granted
- [ ] .env file shared securely
- [ ] Setup documentation reviewed
- [ ] Local environment tested
- [ ] Training on forecast APIs completed
```

---

## 🔒 **Security Checklist**

### **Before Sharing:**
- [ ] Remove all hardcoded passwords
- [ ] Check for API keys in code
- [ ] Verify .gitignore excludes sensitive files
- [ ] Run security scan (if available)
- [ ] Audit environment variables

### **Data Privacy:**
- [ ] Anonymize any customer data
- [ ] Remove PII (Personal Identifiable Information)
- [ ] Check GDPR compliance
- [ ] Document data retention policies

---

## 🚀 **Next Steps for Team Collaboration**

1. **Create Feature Branch**: `git checkout -b feature/forecast-integration`
2. **Update Documentation**: Ensure all setup steps are clear
3. **Add Tests**: Create automated tests for forecast features
4. **Setup CI/CD**: Configure automated testing and deployment
5. **Team Training**: Schedule knowledge sharing session
6. **Monitoring**: Set up feature usage tracking

---

*This guide ensures secure, efficient team collaboration while maintaining enterprise security standards.*</content>
<parameter name="filePath">/Users/k.e.oshada/Documents/OptiWMS/TEAM_COLLABORATION_GUIDE.md