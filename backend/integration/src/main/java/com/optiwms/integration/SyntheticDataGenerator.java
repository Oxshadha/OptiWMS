package com.optiwms.integration;

import com.optiwms.infra.master.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
public class SyntheticDataGenerator {

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private DeliveryPartnerRepository deliveryPartnerRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private MaterialRepository materialRepository;

    private final Random random = new Random();

    /**
     * Generate suppliers with realistic distribution for Sri Lankan WMS:
     * - 40% Sri Lanka (local suppliers)
     * - 20% India (major trading partner - we see "INDIAN DFA" in actual data)
     * - 15% China (manufactured goods, chemicals)
     * - 15% Others (Thailand, Malaysia, UAE, Singapore)
     * - 10% Other countries
     */
    @Transactional
    public int generateSuppliers(int count) {
        int created = 0;
        
        // Calculate distribution
        int sriLankanCount = (int) (count * 0.40);      // 40% Sri Lanka
        int indiaCount = (int) (count * 0.20);          // 20% India
        int chinaCount = (int) (count * 0.15);          // 15% China
        int othersCount = count - sriLankanCount - indiaCount - chinaCount; // Remaining for others
        
        // Sri Lankan cities
        String[] sriLankanCities = {"Colombo", "Kandy", "Galle", "Negombo", "Kurunegala", "Ratnapura", "Jaffna"};
        
        // Indian cities
        String[] indianCities = {"Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune"};
        
        // Chinese cities
        String[] chineseCities = {"Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Hangzhou", "Ningbo"};
        
        // Other countries (Thailand, Malaysia, UAE, Singapore)
        String[] otherCountries = {"Thailand", "Malaysia", "UAE", "Singapore"};
        String[] otherCodes = {"THA", "MYS", "ARE", "SGP"};
        String[] otherCurrencies = {"THB", "MYR", "AED", "SGD"};
        String[] otherCities = {"Bangkok", "Kuala Lumpur", "Dubai", "Singapore"};

        // Generate Sri Lankan suppliers (40%)
        for (int i = 0; i < sriLankanCount; i++) {
            SupplierEntity supplier = createSupplier(
                "SUP-LKA-" + String.format("%03d", i + 1),
                "Sri Lanka",
                "LKA",
                "LKR",
                sriLankanCities[random.nextInt(sriLankanCities.length)],
                i
            );
            supplierRepository.save(supplier);
            created++;
        }

        // Generate Indian suppliers (20%)
        for (int i = 0; i < indiaCount; i++) {
            SupplierEntity supplier = createSupplier(
                "SUP-IND-" + String.format("%03d", i + 1),
                "India",
                "IND",
                "INR",
                indianCities[random.nextInt(indianCities.length)],
                i
            );
            supplierRepository.save(supplier);
            created++;
        }

        // Generate Chinese suppliers (15%)
        for (int i = 0; i < chinaCount; i++) {
            SupplierEntity supplier = createSupplier(
                "SUP-CHN-" + String.format("%03d", i + 1),
                "China",
                "CHN",
                "CNY",
                chineseCities[random.nextInt(chineseCities.length)],
                i
            );
            supplierRepository.save(supplier);
            created++;
        }

        // Generate other countries suppliers (remaining ~25%)
        for (int i = 0; i < othersCount; i++) {
            int countryIndex = i % otherCountries.length;
            SupplierEntity supplier = createSupplier(
                "SUP-" + otherCodes[countryIndex] + "-" + String.format("%03d", i + 1),
                otherCountries[countryIndex],
                otherCodes[countryIndex],
                otherCurrencies[countryIndex],
                otherCities[countryIndex],
                i
            );
            supplierRepository.save(supplier);
            created++;
        }

        return created;
    }

    /**
     * Helper method to create a supplier entity
     */
    private SupplierEntity createSupplier(String code, String country, String countryCode, 
                                         String currency, String city, int index) {
        SupplierEntity supplier = new SupplierEntity();
        supplier.setCode(code);
        supplier.setName(generateCompanyName(country, index));
        supplier.setContactPerson(generateName(country));
        supplier.setEmail(generateEmail(supplier.getName()));
        supplier.setPhone(generatePhone(country));
        supplier.setAddress(generateAddress(country, city));
        supplier.setCity(city);
        supplier.setCountry(country);
        supplier.setCountryCode(countryCode);
        supplier.setCurrencyCode(currency);
        
        // Lead times vary by country
        if (country.equals("Sri Lanka")) {
            supplier.setLeadTimeDays(7 + random.nextInt(14)); // 7-21 days (local)
        } else if (country.equals("India")) {
            supplier.setLeadTimeDays(15 + random.nextInt(30)); // 15-45 days (regional)
        } else if (country.equals("China")) {
            supplier.setLeadTimeDays(30 + random.nextInt(60)); // 30-90 days (international)
        } else {
            supplier.setLeadTimeDays(20 + random.nextInt(50)); // 20-70 days (other international)
        }
        
        supplier.setRating(BigDecimal.valueOf(3.0 + random.nextDouble() * 2.0)); // 3.0-5.0
        supplier.setStatus("active");
        return supplier;
    }


    /**
     * Generate international delivery partners (DHL, FedEx, local couriers)
     */
    @Transactional
    public int generateDeliveryPartners(int count) {
        int created = 0;

        // International couriers
        String[] internationalCouriers = {
            "DHL Express", "FedEx", "UPS", "TNT Express", "Aramex"
        };
        String[] internationalCountries = {"Germany", "USA", "USA", "Netherlands", "UAE"};
        String[] internationalCodes = {"DEU", "USA", "USA", "NLD", "ARE"};

        // Local Sri Lankan couriers
        String[] localCouriers = {
            "Colombo Express", "Kandy Logistics", "Galle Courier Services",
            "Sri Lanka Post", "Express Delivery Lanka"
        };

        // Generate international couriers (40% of total)
        int internationalCount = (int) (count * 0.4);
        for (int i = 0; i < internationalCount && i < internationalCouriers.length; i++) {
            DeliveryPartnerEntity partner = new DeliveryPartnerEntity();
            partner.setPartnerCode("DP-" + internationalCodes[i] + "-" + String.format("%03d", i + 1));
            partner.setCompanyName(internationalCouriers[i]);
            partner.setContactPerson(generateName("International"));
            partner.setEmail(generateEmail(internationalCouriers[i]));
            partner.setPhone(generatePhone(internationalCountries[i]));
            partner.setAddress(generateAddress(internationalCountries[i], ""));
            partner.setCity("Headquarters");
            partner.setCountry(internationalCountries[i]);
            partner.setCountryCode(internationalCodes[i]);
            partner.setCurrencyCode("USD");
            partner.setCarrierType("INTERNATIONAL");
            partner.setInternationalCoverage(new String[]{"LKA", "IND", "CHN", "USA", "GBR", "DEU", "NLD", "ARE"});
            partner.setServiceAreas("{\"countries\": [\"LKA\", \"IND\", \"CHN\", \"USA\", \"GBR\", \"DEU\", \"NLD\", \"ARE\"]}");
            partner.setRating(BigDecimal.valueOf(4.0 + random.nextDouble() * 1.0)); // 4.0-5.0
            partner.setCostPerDelivery(BigDecimal.valueOf(500 + random.nextInt(2000))); // 500-2500 LKR
            partner.setOnTimeDeliveryRate(BigDecimal.valueOf(85 + random.nextInt(15))); // 85-100%
            partner.setTotalShipments(1000 + random.nextInt(9000));
            partner.setStatus("active");

            deliveryPartnerRepository.save(partner);
            created++;
        }

        // Generate local Sri Lankan couriers (60% of total)
        int localCount = count - created;
        for (int i = 0; i < localCount; i++) {
            DeliveryPartnerEntity partner = new DeliveryPartnerEntity();
            String courierName = localCouriers[i % localCouriers.length];
            partner.setPartnerCode("DP-LKA-" + String.format("%03d", i + 1));
            partner.setCompanyName(courierName);
            partner.setContactPerson(generateName("Sri Lanka"));
            partner.setEmail(generateEmail(courierName));
            partner.setPhone(generatePhone("Sri Lanka"));
            partner.setAddress(generateAddress("Sri Lanka", "Colombo"));
            partner.setCity("Colombo");
            partner.setCountry("Sri Lanka");
            partner.setCountryCode("LKA");
            partner.setCurrencyCode("LKR");
            partner.setCarrierType("LOCAL");
            partner.setInternationalCoverage(new String[]{"LKA"});
            partner.setServiceAreas("{\"districts\": [\"Colombo\", \"Kandy\", \"Galle\", \"Negombo\", \"Kurunegala\"]}");
            partner.setRating(BigDecimal.valueOf(3.5 + random.nextDouble() * 1.5)); // 3.5-5.0
            partner.setCostPerDelivery(BigDecimal.valueOf(200 + random.nextInt(500))); // 200-700 LKR
            partner.setOnTimeDeliveryRate(BigDecimal.valueOf(75 + random.nextInt(20))); // 75-95%
            partner.setTotalShipments(500 + random.nextInt(4500));
            partner.setStatus("active");

            deliveryPartnerRepository.save(partner);
            created++;
        }

        return created;
    }

    /**
     * Generate customers (90% Sri Lankan, 10% foreign)
     */
    @Transactional
    public int generateCustomers(int count) {
        int created = 0;

        // 90% Sri Lankan, 10% foreign
        int sriLankanCount = (int) (count * 0.9);
        int foreignCount = count - sriLankanCount;

        // Generate Sri Lankan customers
        String[] sriLankanCities = {"Colombo", "Kandy", "Galle", "Negombo", "Kurunegala", "Jaffna", "Ratnapura"};
        for (int i = 0; i < sriLankanCount; i++) {
            CustomerEntity customer = new CustomerEntity();
            customer.setCode("CUST-LKA-" + String.format("%04d", i + 1));
            customer.setName(generateSriLankanCompanyName(i));
            customer.setEmail(generateEmail(customer.getName()));
            customer.setPhone(generatePhone("Sri Lanka"));
            customer.setAddress(generateAddress("Sri Lanka", sriLankanCities[random.nextInt(sriLankanCities.length)]));
            customer.setCity(sriLankanCities[random.nextInt(sriLankanCities.length)]);
            customer.setCountry("Sri Lanka");
            customer.setCountryCode("LKA");
            customer.setCurrencyCode("LKR");
            
            // Priority tier based on lifetime value
            BigDecimal lifetimeValue = BigDecimal.valueOf(random.nextInt(20000000)); // 0-20M LKR
            customer.setLifetimeValue(lifetimeValue);
            if (lifetimeValue.compareTo(BigDecimal.valueOf(10000000)) > 0) {
                customer.setPriorityTier("GOLD");
            } else if (lifetimeValue.compareTo(BigDecimal.valueOf(5000000)) > 0) {
                customer.setPriorityTier("SILVER");
            } else {
                customer.setPriorityTier("BRONZE");
            }
            
            customer.setStatus("active");

            customerRepository.save(customer);
            created++;
        }

        // Generate foreign customers (10%)
        String[] foreignCountries = {"India", "Singapore", "Malaysia", "UAE", "UK"};
        String[] foreignCodes = {"IND", "SGP", "MYS", "ARE", "GBR"};
        String[] foreignCurrencies = {"INR", "SGD", "MYR", "AED", "GBP"};
        
        for (int i = 0; i < foreignCount; i++) {
            int countryIndex = i % foreignCountries.length;
            CustomerEntity customer = new CustomerEntity();
            customer.setCode("CUST-" + foreignCodes[countryIndex] + "-" + String.format("%03d", i + 1));
            customer.setName(generateCompanyName(foreignCountries[countryIndex], i));
            customer.setEmail(generateEmail(customer.getName()));
            customer.setPhone(generatePhone(foreignCountries[countryIndex]));
            customer.setAddress(generateAddress(foreignCountries[countryIndex], ""));
            customer.setCity("Capital City");
            customer.setCountry(foreignCountries[countryIndex]);
            customer.setCountryCode(foreignCodes[countryIndex]);
            customer.setCurrencyCode(foreignCurrencies[countryIndex]);
            
            BigDecimal lifetimeValue = BigDecimal.valueOf(random.nextInt(5000000)); // 0-5M
            customer.setLifetimeValue(lifetimeValue);
            customer.setPriorityTier("BRONZE"); // Foreign customers mostly bronze
            customer.setStatus("active");

            customerRepository.save(customer);
            created++;
        }

        return created;
    }

    /**
     * Generate company name based on country
     */
    private String generateCompanyName(String country, int index) {
        String[] suffixes = {"(Pvt) Ltd", "Industries", "Trading Company", "Suppliers", "Co", "Limited"};
        String[] prefixes = {"Global", "International", "Premium", "Elite", "Prime", "Superior"};
        
        if (country.equals("India")) {
            String[] indianNames = {"Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Pune", "Hyderabad"};
            return indianNames[index % indianNames.length] + " " + 
                   (random.nextBoolean() ? prefixes[random.nextInt(prefixes.length)] + " " : "") +
                   "Raw Materials " + suffixes[random.nextInt(suffixes.length)];
        } else if (country.equals("China")) {
            String[] chineseNames = {"Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Hangzhou"};
            return chineseNames[index % chineseNames.length] + " " +
                   "Chemical " + suffixes[random.nextInt(suffixes.length)];
        } else if (country.equals("Sri Lanka")) {
            String[] sriLankanNames = {"Colombo", "Kandy", "Galle", "Negombo"};
            return sriLankanNames[index % sriLankanNames.length] + " " +
                   "Suppliers " + suffixes[random.nextInt(suffixes.length)];
        } else {
            return country + " " + prefixes[random.nextInt(prefixes.length)] + " " +
                   "Suppliers " + suffixes[random.nextInt(suffixes.length)];
        }
    }

    /**
     * Generate Sri Lankan company name
     */
    private String generateSriLankanCompanyName(int index) {
        String[] types = {"Supermarket", "Retail Store", "Trading Company", "Distributor", "Wholesaler", "Shop"};
        String[] locations = {"Colombo", "Kandy", "Galle", "Negombo", "Kurunegala", "Jaffna"};
        String[] names = {"Silva", "Perera", "Fernando", "Wijesinghe", "De Silva", "Jayasinghe"};
        
        return locations[index % locations.length] + " " + 
               names[random.nextInt(names.length)] + " " + 
               types[random.nextInt(types.length)];
    }

    /**
     * Generate name based on country
     */
    private String generateName(String country) {
        if (country.equals("India")) {
            String[] firstNames = {"Raj", "Priya", "Arun", "Lakshmi", "Suresh", "Kavita"};
            String[] lastNames = {"Kumar", "Sharma", "Patel", "Singh", "Reddy", "Nair"};
            return firstNames[random.nextInt(firstNames.length)] + " " + lastNames[random.nextInt(lastNames.length)];
        } else if (country.equals("China")) {
            String[] chineseNames = {"Li Wei", "Zhang Ming", "Wang Fang", "Chen Lei", "Liu Yang"};
            return chineseNames[random.nextInt(chineseNames.length)];
        } else if (country.equals("Sri Lanka")) {
            String[] firstNames = {"Nimal", "Kamani", "Dilshan", "Priyanka", "Saman", "Chaminda"};
            String[] lastNames = {"Perera", "Silva", "Fernando", "Wijesinghe", "De Silva", "Jayasinghe"};
            return firstNames[random.nextInt(firstNames.length)] + " " + lastNames[random.nextInt(lastNames.length)];
        } else {
            String[] firstNames = {"John", "Mary", "David", "Sarah", "Michael", "Emma"};
            String[] lastNames = {"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia"};
            return firstNames[random.nextInt(firstNames.length)] + " " + lastNames[random.nextInt(lastNames.length)];
        }
    }

    /**
     * Generate email
     */
    private String generateEmail(String companyName) {
        String clean = companyName.toLowerCase()
                .replaceAll("[^a-z0-9]", "")
                .replaceAll("\\s+", "");
        return clean + "@" + (random.nextBoolean() ? "gmail.com" : "company.com");
    }

    /**
     * Generate phone number based on country
     */
    private String generatePhone(String country) {
        if (country.equals("India")) {
            return "+91-" + (10 + random.nextInt(90)) + "-" + 
                   String.format("%07d", random.nextInt(10000000));
        } else if (country.equals("China")) {
            return "+86-" + (10 + random.nextInt(90)) + "-" + 
                   String.format("%08d", random.nextInt(100000000));
        } else if (country.equals("Sri Lanka")) {
            return "+94-" + (11 + random.nextInt(90)) + "-" + 
                   String.format("%07d", random.nextInt(10000000));
        } else {
            return "+1-" + String.format("%03d", random.nextInt(1000)) + "-" + 
                   String.format("%03d", random.nextInt(1000)) + "-" + 
                   String.format("%04d", random.nextInt(10000));
        }
    }

    /**
     * Generate address
     */
    private String generateAddress(String country, String city) {
        if (country.equals("India")) {
            return (random.nextInt(999) + 1) + " " + 
                   (random.nextBoolean() ? "MG Road" : "Main Street") + "\n" +
                   city + " " + String.format("%06d", random.nextInt(1000000)) + "\n" +
                   country;
        } else if (country.equals("China")) {
            return (random.nextInt(999) + 1) + " " +
                   (random.nextBoolean() ? "Nanjing Road" : "Main Avenue") + "\n" +
                   city + " " + String.format("%06d", random.nextInt(1000000)) + "\n" +
                   country;
        } else if (country.equals("Sri Lanka")) {
            return (random.nextInt(999) + 1) + " " +
                   (random.nextBoolean() ? "Galle Road" : "Main Street") + "\n" +
                   city + " " + String.format("%05d", random.nextInt(100000)) + "\n" +
                   country;
        } else {
            return (random.nextInt(999) + 1) + " " +
                   (random.nextBoolean() ? "Main Street" : "High Street") + "\n" +
                   city + "\n" + country;
        }
    }

    /**
     * Generate all synthetic data
     */
    @Transactional
    public GenerationResult generateAll(int suppliersCount, int couriersCount, int customersCount) {
        int suppliers = generateSuppliers(suppliersCount);
        int couriers = generateDeliveryPartners(couriersCount);
        int customers = generateCustomers(customersCount);

        return new GenerationResult(suppliers, couriers, customers);
    }

    public static class GenerationResult {
        private final int suppliersCreated;
        private final int couriersCreated;
        private final int customersCreated;

        public GenerationResult(int suppliersCreated, int couriersCreated, int customersCreated) {
            this.suppliersCreated = suppliersCreated;
            this.couriersCreated = couriersCreated;
            this.customersCreated = customersCreated;
        }

        public int getSuppliersCreated() { return suppliersCreated; }
        public int getCouriersCreated() { return couriersCreated; }
        public int getCustomersCreated() { return customersCreated; }
    }
}

