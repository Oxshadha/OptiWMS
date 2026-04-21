# OptiWMS AI Deployment Changelog

## Date: 21 April 2026

### 🎯 **Session Objective**
End-to-end deployment of OptiWMS AI forecasting system with controlled production candidate cycle.

---

## ✅ **COMPLETED CHANGES**

### 1. **Infrastructure Setup**
- ✅ Brought up core-api service (port 8080)
- ✅ Brought up frontend service (port 3000)
- ✅ Deployed forecast-service (port 8091)
- ✅ Deployed orchestrator-service (port 8092)
- ✅ Configured Docker Compose for AI services stack

### 2. **Data Preparation**
- ✅ Seeded forecast_sku_mapping table for dataset B
  - 270 exact material code matches
  - 103 temporary deterministic FG rank mappings
- ✅ Validated WMS database integration
- ✅ Confirmed forecast service can access live data

### 3. **Model Configuration**
- ✅ Registered CATBOOST model for dataset B in model registry
- ✅ Set up artifact directory paths for model loading
- ✅ Configured runtime data source mode (wms_db)

### 4. **Shadow Mode Implementation**
- ✅ Enabled governance monitoring (GOVERNANCE_ENABLED=true)
- ✅ Disabled auto-promotion/rollback for safe testing
- ✅ Set governance dataset to B, model CATBOOST, fallback ARIMA
- ✅ Created automated forecast execution script (`shadow_forecast.sh`)
- ✅ Created feedback collection script (`collect_feedback.sh`)

### 5. **Performance Monitoring**
- ✅ Fixed latency threshold issue (ALERT_P95_LATENCY_MS_THRESHOLD=1000.0)
- ✅ Validated inference performance (P95 ~760ms, well under 2500ms limit)
- ✅ Set up operational health monitoring

### 6. **Quality Assurance**
- ✅ All production readiness gates PASSING:
  - WAPE: 0.12 ≤ 0.135 ✅
  - Bias_abs: 0.04 ≤ 0.10 ✅
  - Under-forecast Rate: 0.55 ≤ 0.60 ✅
  - MASE Mean: 1.08 ≤ 1.10 ✅
  - Fallback Rate: 0.0 ≤ 0.05 ✅
  - Hard Error Rate: 0.0 ≤ 0.01 ✅
  - P95 Latency: 762ms ≤ 2500ms ✅

### 7. **Operational Mode Transition**
- ✅ Enabled auto-promotion/rollback (GOVERNANCE_AUTO_PROMOTE=true)
- ✅ Confirmed CATBOOST as champion model for dataset B
- ✅ Activated continuous governance monitoring (180s intervals)

---

## 📋 **REMAINING TASKS**

### High Priority
- [ ] **Expand SKU Mapping Coverage**
  - Replace 103 temporary FG mappings with business-approved mappings
  - Onboard additional product categories beyond current 270 mappings
  - Validate mapping accuracy against business rules

- [ ] **Production Scheduling**
  - Set up cron jobs for daily/weekly forecast runs
  - Configure production alert webhooks
  - Establish backup/DR procedures for AI services

### Medium Priority
- [ ] **Feedback Loop Enhancement**
  - Improve shadow feedback evaluator coverage (currently 0.7%)
  - Implement real-time feedback collection from WMS operations
  - Add automated model retraining triggers

- [ ] **Monitoring & Alerting**
  - Configure production alert routing (currently set to critical level)
  - Set up dashboard for AI service health metrics
  - Implement automated incident response

### Low Priority
- [ ] **Model Expansion**
  - Onboard PV2 dataset models (currently using B as fallback)
  - Implement multi-model ensemble strategies
  - Add model explainability features

- [ ] **Performance Optimization**
  - Optimize inference latency (current P95: 762ms)
  - Implement model caching for frequently requested SKUs
  - Add horizontal scaling capabilities

---

## 🔍 **CURRENT SYSTEM STATUS**

### Services
- **Core API**: ✅ Running (port 8080)
- **Frontend**: ✅ Running (port 3000)
- **Forecast Service**: ✅ Running (port 8091) - Operational Mode
- **Orchestrator**: ✅ Running (port 8092)

### AI Configuration
- **Dataset**: B (fallback: PV2 planned)
- **Primary Model**: CATBOOST (champion status: ✅)
- **Fallback Model**: ARIMA
- **Governance**: ✅ Enabled (auto-promote/rollback active)
- **Quality Gates**: ✅ All passing

### Data Status
- **SKU Mappings**: 373 total (270 exact, 103 temporary)
- **Forecast Runs**: 209+ completed successfully
- **Feedback Coverage**: Low (156/22248 matured predictions)

---

## 📈 **METRICS TO MONITOR**

### Quality Metrics
- WAPE (target: <0.135)
- Bias Absolute % (target: <0.10)
- Under-forecast Rate (target: <0.60)
- MASE Mean (target: <1.10)

### Operational Metrics
- P95 Latency (target: <2500ms)
- Fallback Rate (target: <0.05)
- Hard Error Rate (target: <0.01)
- Service Uptime (target: >99.9%)

### Business Metrics
- SKU Mapping Coverage (target: >95%)
- Forecast Run Success Rate (target: >99%)
- Feedback Data Collection (target: >80% coverage)

---

## 🚨 **KNOWN ISSUES**

1. **Low Feedback Coverage**: Shadow evaluator shows only 0.7% coverage due to forecast timing vs actual data maturity
2. **Temporary Mappings**: 103 FG SKUs using deterministic placeholder mappings
3. **PV2 Dataset**: Models not properly configured for production use
4. **Cron Scheduling**: Automated scheduling not implemented (cron permission issues)

---

## 📝 **NEXT IMMEDIATE ACTIONS**

1. **Complete SKU Mapping** - Replace temporary mappings with business-approved ones
2. **Implement Production Scheduling** - Set up automated daily forecast runs
3. **Enhance Feedback Collection** - Improve evaluator coverage and real-time feedback
4. **Configure Alerting** - Set up production alert routing and monitoring

---

*Last Updated: 21 April 2026*</content>
<parameter name="filePath">/Users/k.e.oshada/Documents/OptiWMS/DEPLOYMENT_CHANGELOG.md