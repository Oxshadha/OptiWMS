# AI Services Team Handoff (Enterprise Style)

This guide explains how to share your AI microservice work with other teams safely and consistently.

## Scope
- Shared platform: forecast-service, orchestrator-service, slotting-service, and common libraries.
- Goal: let other teams consume your APIs and model outputs without sharing secrets or sensitive datasets.

## What To Commit To GitHub
- Service code and API contracts.
- Docker and compose files with non-secret defaults.
- Environment templates only.
- Runbooks, architecture docs, and onboarding docs.
- Synthetic data generators and small anonymized sample files.

Examples in this repo:
- ai-services/forecast-service
- ai-services/orchestrator-service
- ai-services/slotting-service
- ai-services/libs
- ai-services/docker-compose.ai.yml
- ai-services/.env.example
- infra/.env.example

## What Must Stay Private
- Any real .env file with tokens, passwords, webhook URLs, or private hostnames.
- Production database dumps and SQLite snapshots with operational data.
- Any dataset that contains real customer, order, or PII/business-sensitive values.

Private sharing channels (enterprise standard):
- Secret manager (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager).
- Encrypted file share approved by your company.
- CI/CD protected variables for deployment pipelines.

## Do Teammates Need Your Current Dataset?
Short answer: usually no for model serving, yes for retraining/evaluation.

- For model upload and online inference:
  - Teammates need model artifacts + metadata + schema contract.
  - They do not need your full raw training dataset.
- For retraining or deep validation:
  - Use governed data sources (data lake/warehouse), not GitHub uploads.
  - Provide a data contract and access process, not ad hoc file sharing.

## Model Output Sharing Pattern
For cross-team usage, publish outputs through stable interfaces:
- API endpoints (preferred for real-time use).
- Versioned artifact storage (S3/Blob/GCS) for batch files.
- Registry metadata (model name, version, dataset tag, created_at, metrics).

Minimum metadata to publish with each model/output:
- dataset
- model_name
- model_version
- feature schema version
- training window
- evaluation metrics (WAPE, bias, MASE, under-forecast rate)
- fallback policy

## Four-Service Common Architecture Expectations
Apply this across all AI services, not only forecast:
- Common auth approach (service token or gateway auth).
- Common logging format (JSON structured logs).
- Common tracing/correlation IDs.
- Common health/readiness endpoints.
- Common error code conventions.
- Common release/version tagging.

## Team Onboarding Checklist
1. Clone repo and check out integration branch.
2. Copy templates:
   - ai-services/.env.example -> ai-services/.env
   - infra/.env.example -> infra/.env
3. Get secrets from approved secret manager.
4. Start dependencies and AI stack.
5. Verify health endpoints.
6. Validate one sample run end-to-end.

## Enterprise Best Practice Summary
- GitHub is for code, contracts, templates, and docs.
- Secrets and sensitive data never go to Git.
- Datasets are governed assets, not attachment files.
- Model outputs are shared via APIs/artifact registry with versioned metadata.
- Promotion to operational use requires acceptance gate and monitored shadow period.