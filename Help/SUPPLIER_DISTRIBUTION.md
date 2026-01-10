# Supplier Distribution - Realistic for Sri Lankan WMS

## 📊 Final Distribution

Based on your actual data (showing "INDIAN DFA" and many "IMPORTED" items) and realistic trade patterns for a Sri Lankan manufacturing/warehousing company:

### Supplier Distribution:
- **40% Sri Lanka** (Local suppliers)
  - Fast lead times: 7-21 days
  - Local raw materials, packaging, services
  - Cities: Colombo, Kandy, Galle, Negombo, Kurunegala, Ratnapura, Jaffna

- **20% India** (Major regional trading partner)
  - Medium lead times: 15-45 days
  - Matches your actual data: "INDIAN DFA" found in CSV
  - Close proximity, cost-effective
  - Cities: Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad, Pune

- **15% China** (International manufactured goods)
  - Longer lead times: 30-90 days
  - Chemicals, electronics, manufactured items
  - Cities: Shanghai, Beijing, Guangzhou, Shenzhen, Hangzhou, Ningbo

- **25% Others** (Regional/International)
  - Medium-long lead times: 20-70 days
  - Thailand, Malaysia, UAE, Singapore
  - Various specialized goods

---

## 🎯 Why This Distribution?

### Matches Your Actual Data:
1. **"INDIAN DFA"** found in `Raw matrilas not store in pallets.csv` → Confirms Indian suppliers
2. **Many "IMPORTED" items** in materials → Confirms international sourcing
3. **Sri Lankan company** → Local suppliers for local materials

### Realistic Trade Patterns:
- **Sri Lanka** imports significantly from **India** (close proximity, FTA benefits)
- **China** is a major source for manufactured goods and chemicals
- **Local suppliers** handle packaging, local raw materials, services
- **Regional suppliers** (Thailand, Malaysia, Singapore) for specialized items

---

## 📈 Example: 15 Suppliers Generated

```
6 suppliers from Sri Lanka (40%)
  - SUP-LKA-001 to SUP-LKA-006
  - Lead times: 7-21 days
  - Currency: LKR

3 suppliers from India (20%)
  - SUP-IND-001 to SUP-IND-003
  - Lead times: 15-45 days
  - Currency: INR

2 suppliers from China (15%)
  - SUP-CHN-001 to SUP-CHN-002
  - Lead times: 30-90 days
  - Currency: CNY

4 suppliers from Others (25%)
  - SUP-THA-001 (Thailand)
  - SUP-MYS-001 (Malaysia)
  - SUP-ARE-001 (UAE)
  - SUP-SGP-001 (Singapore)
  - Lead times: 20-70 days
  - Currencies: THB, MYR, AED, SGD
```

---

## ✅ Benefits of This Distribution

1. **Realistic Lead Times**: Local suppliers faster, international slower
2. **Matches Actual Data**: Reflects "INDIAN DFA" and import patterns
3. **Currency Diversity**: Multiple currencies for realistic transactions
4. **Geographic Spread**: Covers local, regional, and international suppliers
5. **Business Logic**: Supports WMS features like:
   - Supplier performance tracking
   - Lead time calculations
   - Currency conversion
   - International shipping coordination

---

## 🚀 Usage

The synthetic data generator now uses this distribution automatically:

```bash
# Generate 15 suppliers with new distribution
curl -X POST -u admin:admin123 \
  -H "Content-Type: application/json" \
  -d '{"count": 15}' \
  http://localhost:8080/api/integration/synthetic/suppliers
```

**Result:**
- 6 Sri Lankan suppliers (40%)
- 3 Indian suppliers (20%)
- 2 Chinese suppliers (15%)
- 4 Other suppliers (25%)

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Implemented and Ready

