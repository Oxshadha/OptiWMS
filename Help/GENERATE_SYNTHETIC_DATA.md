# Generate Synthetic Data - Step by Step Guide

## 🎯 What Gets Generated

### Suppliers (Realistic Distribution for Sri Lankan WMS)
- **40%** Sri Lanka (Colombo, Kandy, Galle, Negombo suppliers) - **Local suppliers**
- **20%** India (Mumbai, Delhi, Bangalore, Chennai suppliers) - **Major trading partner** (matches "INDIAN DFA" in actual data)
- **15%** China (Shanghai, Beijing, Guangzhou, Shenzhen suppliers) - **Manufactured goods, chemicals**
- **25%** Others (Thailand, Malaysia, UAE, Singapore) - **Regional suppliers**

**Features:**
- Country codes (LKA, IND, CHN, THA, MYS, ARE, SGP)
- Currency codes (LKR, INR, CNY, THB, MYR, AED, SGD)
- Realistic company names
- Phone numbers in country format
- Addresses in country format
- **Lead times vary by country:**
  - Sri Lanka: 7-21 days (local, fast)
  - India: 15-45 days (regional)
  - China: 30-90 days (international)
  - Others: 20-70 days (international)
- Ratings: 3.0-5.0

### Delivery Partners (International + Local)
- **40%** International couriers (DHL, FedEx, UPS, TNT, Aramex)
- **60%** Local Sri Lankan couriers

**International Features:**
- Multiple country coverage
- Higher ratings (4.0-5.0)
- Higher costs (500-2500 LKR)
- Better on-time delivery (85-100%)

**Local Features:**
- Sri Lanka only
- Lower costs (200-700 LKR)
- Good ratings (3.5-5.0)
- Good on-time delivery (75-95%)

### Customers
- **90%** Sri Lankan customers
- **10%** Foreign customers (India, Singapore, Malaysia, UAE, UK)

**Sri Lankan Features:**
- Cities: Colombo, Kandy, Galle, Negombo, Kurunegala, Jaffna, Ratnapura
- Priority tiers: GOLD (>10M LKR), SILVER (5-10M), BRONZE (<5M)
- Sri Lankan company names
- LKR currency

**Foreign Features:**
- Mostly BRONZE tier
- Various currencies (INR, SGD, MYR, AED, GBP)
- International addresses

---

## 🚀 How to Generate

### Option 1: Generate All at Once (Recommended)

```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "suppliersCount": 15,
    "couriersCount": 10,
    "customersCount": 30
  }' \
  http://localhost:8080/api/integration/synthetic/all
```

**Default counts:**
- Suppliers: 15
- Delivery Partners: 10
- Customers: 30

### Option 2: Generate Separately

#### Generate Suppliers Only
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 15}' \
  http://localhost:8080/api/integration/synthetic/suppliers
```

#### Generate Delivery Partners Only
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 10}' \
  http://localhost:8080/api/integration/synthetic/delivery-partners
```

#### Generate Customers Only
```bash
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 30}' \
  http://localhost:8080/api/integration/synthetic/customers
```

---

## ✅ Verify Generated Data

### Check Suppliers
```bash
# Count suppliers
curl -u admin:admin123 http://localhost:8080/api/master/suppliers | jq 'length'

# View suppliers by country
curl -u admin:admin123 http://localhost:8080/api/master/suppliers | jq 'group_by(.country) | map({country: .[0].country, count: length})'
```

### Check Delivery Partners
```bash
# Count delivery partners
curl -u admin:admin123 http://localhost:8080/api/master/delivery-partners | jq 'length'

# View by carrier type
curl -u admin:admin123 http://localhost:8080/api/master/delivery-partners | jq 'group_by(.carrierType) | map({type: .[0].carrierType, count: length})'
```

### Check Customers
```bash
# Count customers
curl -u admin:admin123 http://localhost:8080/api/master/customers | jq 'length'

# View by country
curl -u admin:admin123 http://localhost:8080/api/master/customers | jq 'group_by(.country) | map({country: .[0].country, count: length})'

# View by priority tier
curl -u admin:admin123 http://localhost:8080/api/master/customers | jq 'group_by(.priorityTier) | map({tier: .[0].priorityTier, count: length})'
```

---

## 📊 Expected Results

### Suppliers (15 total)
- **6** from Sri Lanka (LKA, LKR) - 40%
- **3** from India (IND, INR) - 20%
- **2** from China (CHN, CNY) - 15%
- **4** from Others (Thailand, Malaysia, UAE, Singapore) - 25%

### Delivery Partners (10 total)
- **4** International (DHL, FedEx, UPS, TNT)
- **6** Local Sri Lankan couriers

### Customers (30 total)
- **27** Sri Lankan (90%)
  - ~9 GOLD tier
  - ~9 SILVER tier
  - ~9 BRONZE tier
- **3** Foreign (10%)
  - India, Singapore, Malaysia, etc.

---

## 🎨 Example Generated Data

### Supplier Examples

**Sri Lankan Supplier (Local):**
```json
{
  "code": "SUP-LKA-001",
  "name": "Colombo Premium Raw Materials (Pvt) Ltd",
  "country": "Sri Lanka",
  "countryCode": "LKA",
  "currencyCode": "LKR",
  "city": "Colombo",
  "phone": "+94-11-2345678",
  "leadTimeDays": 14,
  "rating": 4.5
}
```

**Indian Supplier (Regional):**
```json
{
  "code": "SUP-IND-001",
  "name": "Mumbai Premium Raw Materials (Pvt) Ltd",
  "country": "India",
  "countryCode": "IND",
  "currencyCode": "INR",
  "city": "Mumbai",
  "phone": "+91-45-1234567",
  "leadTimeDays": 30,
  "rating": 4.2
}
```

**Chinese Supplier (International):**
```json
{
  "code": "SUP-CHN-001",
  "name": "Shanghai Chemical Industries Ltd",
  "country": "China",
  "countryCode": "CHN",
  "currencyCode": "CNY",
  "city": "Shanghai",
  "phone": "+86-21-12345678",
  "leadTimeDays": 60,
  "rating": 3.8
}
```

### Delivery Partner Example (International)
```json
{
  "partnerCode": "DP-DEU-001",
  "companyName": "DHL Express",
  "country": "Germany",
  "countryCode": "DEU",
  "carrierType": "INTERNATIONAL",
  "internationalCoverage": ["LKA", "IND", "CHN", "USA", "GBR"],
  "rating": 4.8,
  "costPerDelivery": 1500,
  "onTimeDeliveryRate": 95
}
```

### Customer Example (Sri Lankan)
```json
{
  "code": "CUST-LKA-0001",
  "name": "Colombo Silva Supermarket",
  "country": "Sri Lanka",
  "countryCode": "LKA",
  "currencyCode": "LKR",
  "city": "Colombo",
  "priorityTier": "GOLD",
  "lifetimeValue": 12500000
}
```

---

## 🔧 Customize Counts

You can customize the number of records generated:

```bash
# Generate more suppliers
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 25}' \
  http://localhost:8080/api/integration/synthetic/suppliers

# Generate more customers
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 50}' \
  http://localhost:8080/api/integration/synthetic/customers
```

---

## 📝 Complete Generation Script

Save this as `generate-synthetic.sh`:

```bash
#!/bin/bash

echo "Generating synthetic data..."

# Generate all
RESPONSE=$(curl -s -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{
    "suppliersCount": 15,
    "couriersCount": 10,
    "customersCount": 30
  }' \
  http://localhost:8080/api/integration/synthetic/all)

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Synthetic data generated successfully!"
    echo "$RESPONSE" | jq '.'
else
    echo "❌ Failed to generate synthetic data"
    echo "$RESPONSE"
fi
```

---

**Last Updated:** 2025-01-XX  
**Status:** Ready to Use

