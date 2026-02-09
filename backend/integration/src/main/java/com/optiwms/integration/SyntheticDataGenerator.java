package com.optiwms.integration;

import com.optiwms.coreapp.orders.OrderService;
import com.optiwms.coreapp.tasks.TaskService;
import com.optiwms.domain.orders.Order;
import com.optiwms.domain.tasks.Task;
import com.optiwms.infra.orders.OrderEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.*;
import com.optiwms.infra.orders.OrderItemEntity;
import com.optiwms.infra.orders.OrderItemRepository;
import com.optiwms.infra.orders.OrderRepository;
import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private OrderService orderService;

    @Autowired
    private TaskService taskService;

    @Autowired
    private com.optiwms.infra.tasks.TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InventoryItemRepository inventoryItemRepository;

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
            String code = "SUP-LKA-" + String.format("%03d", i + 1);
            // Check if code already exists, if so, add timestamp suffix
            if (supplierRepository.findByCode(code).isPresent()) {
                code = "SUP-LKA-" + String.format("%03d", i + 1) + "-" + System.currentTimeMillis();
            }
            SupplierEntity supplier = createSupplier(
                code,
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
            String code = "SUP-IND-" + String.format("%03d", i + 1);
            if (supplierRepository.findByCode(code).isPresent()) {
                code = "SUP-IND-" + String.format("%03d", i + 1) + "-" + System.currentTimeMillis();
            }
            SupplierEntity supplier = createSupplier(
                code,
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
            String code = "SUP-CHN-" + String.format("%03d", i + 1);
            if (supplierRepository.findByCode(code).isPresent()) {
                code = "SUP-CHN-" + String.format("%03d", i + 1) + "-" + System.currentTimeMillis();
            }
            SupplierEntity supplier = createSupplier(
                code,
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
            String code = "SUP-" + otherCodes[countryIndex] + "-" + String.format("%03d", i + 1);
            if (supplierRepository.findByCode(code).isPresent()) {
                code = "SUP-" + otherCodes[countryIndex] + "-" + String.format("%03d", i + 1) + "-" + System.currentTimeMillis();
            }
            SupplierEntity supplier = createSupplier(
                code,
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
            String code = "DP-" + internationalCodes[i] + "-" + String.format("%03d", i + 1);
            if (deliveryPartnerRepository.findByPartnerCode(code).isPresent()) {
                code = "DP-" + internationalCodes[i] + "-" + String.format("%03d", i + 1) + "-" + System.currentTimeMillis();
            }
            DeliveryPartnerEntity partner = new DeliveryPartnerEntity();
            partner.setPartnerCode(code);
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
            String code = "DP-LKA-" + String.format("%03d", i + 1);
            if (deliveryPartnerRepository.findByPartnerCode(code).isPresent()) {
                code = "DP-LKA-" + String.format("%03d", i + 1) + "-" + System.currentTimeMillis();
            }
            DeliveryPartnerEntity partner = new DeliveryPartnerEntity();
            String courierName = localCouriers[i % localCouriers.length];
            partner.setPartnerCode(code);
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
            String code = "CUST-LKA-" + String.format("%04d", i + 1);
            if (customerRepository.findByCode(code).isPresent()) {
                code = "CUST-LKA-" + String.format("%04d", i + 1) + "-" + System.currentTimeMillis();
            }
            CustomerEntity customer = new CustomerEntity();
            customer.setCode(code);
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
            String code = "CUST-" + foreignCodes[countryIndex] + "-" + String.format("%03d", i + 1);
            if (customerRepository.findByCode(code).isPresent()) {
                code = "CUST-" + foreignCodes[countryIndex] + "-" + String.format("%03d", i + 1) + "-" + System.currentTimeMillis();
            }
            CustomerEntity customer = new CustomerEntity();
            customer.setCode(code);
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
     * Generate orders (inbound and outbound) with order items
     */
    @Transactional
    public int generateOrders(int inboundCount, int outboundCount) {
        int created = 0;
        List<WarehouseEntity> warehouses = warehouseRepository.findAll();
        List<SupplierEntity> suppliers = supplierRepository.findAll();
        List<CustomerEntity> customers = customerRepository.findAll();
        List<MaterialEntity> materials = materialRepository.findAll();

        if (warehouses.isEmpty() || materials.isEmpty()) {
            throw new RuntimeException("Need warehouses and materials to generate orders");
        }

        // Generate inbound orders
        for (int i = 0; i < inboundCount; i++) {
            if (suppliers.isEmpty()) break;
            
            WarehouseEntity warehouse = warehouses.get(random.nextInt(warehouses.size()));
            SupplierEntity supplier = suppliers.get(random.nextInt(suppliers.size()));
            
            String orderNumber = "IN-" + String.format("%06d", i + 1);
            // Check if order number already exists
            if (orderRepository.findByOrderNumber(orderNumber).isPresent()) {
                orderNumber = "IN-" + String.format("%06d", i + 1) + "-" + System.currentTimeMillis();
            }
            
            Order order = new Order();
            order.setOrderNumber(orderNumber);
            order.setOrderType("inbound");
            order.setSupplierId(supplier.getId());
            order.setWarehouseId(warehouse.getId());
            order.setStatus(random.nextBoolean() ? "pending" : "received");
            order.setPriority(random.nextBoolean() ? "normal" : "high");
            order.setOrderDate(LocalDate.now().minusDays(random.nextInt(30)));
            order.setExpectedDate(LocalDate.now().plusDays(random.nextInt(7)));
            order.setTotalAmount(BigDecimal.valueOf(random.nextInt(100000) + 10000));
            
            Order createdOrder = orderService.create(order);
            
            // Add 1-5 order items per order
            int itemCount = random.nextInt(5) + 1;
            for (int j = 0; j < itemCount; j++) {
                MaterialEntity material = materials.get(random.nextInt(materials.size()));
                OrderItemEntity item = new OrderItemEntity();
                item.setOrderId(createdOrder.getId());
                item.setMaterialId(material.getId());
                // Convert demand forecast to integer quantity using ceil
                int qty = (int) Math.ceil(random.nextDouble() * 100 + 10);
                item.setQuantity(qty);
                item.setUnitPrice(BigDecimal.valueOf(random.nextDouble() * 1000 + 100));
                item.setStatus("pending");
                orderItemRepository.save(item);
            }
            
            created++;
        }

        // Generate outbound orders
        for (int i = 0; i < outboundCount; i++) {
            if (customers.isEmpty()) break;
            
            WarehouseEntity warehouse = warehouses.get(random.nextInt(warehouses.size()));
            CustomerEntity customer = customers.get(random.nextInt(customers.size()));
            
            String orderNumber = "OUT-" + String.format("%06d", i + 1);
            // Check if order number already exists
            if (orderRepository.findByOrderNumber(orderNumber).isPresent()) {
                orderNumber = "OUT-" + String.format("%06d", i + 1) + "-" + System.currentTimeMillis();
            }
            
            Order order = new Order();
            order.setOrderNumber(orderNumber);
            order.setOrderType("outbound");
            order.setCustomerId(customer.getId());
            order.setWarehouseId(warehouse.getId());
            order.setStatus(random.nextBoolean() ? "pending" : (random.nextBoolean() ? "picking" : "packed"));
            order.setPriority(random.nextBoolean() ? "normal" : "high");
            order.setOrderDate(LocalDate.now().minusDays(random.nextInt(30)));
            order.setExpectedDate(LocalDate.now().plusDays(random.nextInt(7)));
            order.setTotalAmount(BigDecimal.valueOf(random.nextInt(100000) + 10000));
            
            Order createdOrder = orderService.create(order);
            
            // Add 1-5 order items per order
            int itemCount = random.nextInt(5) + 1;
            for (int j = 0; j < itemCount; j++) {
                MaterialEntity material = materials.get(random.nextInt(materials.size()));
                OrderItemEntity item = new OrderItemEntity();
                item.setOrderId(createdOrder.getId());
                item.setMaterialId(material.getId());
                // Convert demand forecast to integer quantity using ceil
                int qty = (int) Math.ceil(random.nextDouble() * 50 + 5);
                item.setQuantity(qty);
                item.setUnitPrice(BigDecimal.valueOf(random.nextDouble() * 1000 + 100));
                item.setStatus("pending");
                orderItemRepository.save(item);
            }
            
            created++;
        }

        return created;
    }

    /**
     * Generate tasks (picking, putaway, packing)
     */
    @Transactional
    public int generateTasks(int pickingCount, int putawayCount, int packingCount) {
        int created = 0;
        List<WarehouseEntity> warehouses = warehouseRepository.findAll();
        List<OrderEntity> orders = orderRepository.findAll();
        List<com.optiwms.infra.users.UserEntity> workers = userRepository.findAll();

        if (warehouses.isEmpty()) {
            throw new RuntimeException("Need warehouses to generate tasks");
        }

        // Generate picking tasks
        for (int i = 0; i < pickingCount; i++) {
            WarehouseEntity warehouse = warehouses.get(random.nextInt(warehouses.size()));
            UUID orderId = null;
            if (!orders.isEmpty()) {
                OrderEntity order = orders.get(random.nextInt(orders.size()));
                if ("outbound".equals(order.getOrderType())) {
                    orderId = order.getId();
                }
            }
            
            String taskNumber = "PICK-" + String.format("%06d", i + 1);
            if (taskRepository.findByTaskNumber(taskNumber).isPresent()) {
                taskNumber = "PICK-" + String.format("%06d", i + 1) + "-" + System.currentTimeMillis();
            }
            Task task = new Task();
            task.setTaskNumber(taskNumber);
            task.setTaskType("picking");
            task.setWarehouseId(warehouse.getId());
            if (!workers.isEmpty() && random.nextBoolean()) {
                task.setAssignedTo(workers.get(random.nextInt(workers.size())).getId());
            }
            task.setPriority(random.nextBoolean() ? "normal" : "high");
            task.setStatus(random.nextBoolean() ? "pending" : (random.nextBoolean() ? "in_progress" : "completed"));
            task.setDueDate(LocalDateTime.now().plusDays(random.nextInt(3)));
            task.setReferenceType("order");
            task.setReferenceId(orderId);
            
            taskService.create(task);
            created++;
        }

        // Generate putaway tasks
        for (int i = 0; i < putawayCount; i++) {
            WarehouseEntity warehouse = warehouses.get(random.nextInt(warehouses.size()));
            UUID orderId = null;
            if (!orders.isEmpty()) {
                OrderEntity order = orders.get(random.nextInt(orders.size()));
                if ("inbound".equals(order.getOrderType())) {
                    orderId = order.getId();
                }
            }
            
            String taskNumber = "PUT-" + String.format("%06d", i + 1);
            if (taskRepository.findByTaskNumber(taskNumber).isPresent()) {
                taskNumber = "PUT-" + String.format("%06d", i + 1) + "-" + System.currentTimeMillis();
            }
            Task task = new Task();
            task.setTaskNumber(taskNumber);
            task.setTaskType("putaway");
            task.setWarehouseId(warehouse.getId());
            if (!workers.isEmpty() && random.nextBoolean()) {
                task.setAssignedTo(workers.get(random.nextInt(workers.size())).getId());
            }
            task.setPriority(random.nextBoolean() ? "normal" : "high");
            task.setStatus(random.nextBoolean() ? "pending" : (random.nextBoolean() ? "in_progress" : "completed"));
            task.setDueDate(LocalDateTime.now().plusDays(random.nextInt(3)));
            task.setReferenceType("order");
            task.setReferenceId(orderId);
            
            taskService.create(task);
            created++;
        }

        // Generate packing tasks
        for (int i = 0; i < packingCount; i++) {
            WarehouseEntity warehouse = warehouses.get(random.nextInt(warehouses.size()));
            UUID orderId = null;
            if (!orders.isEmpty()) {
                OrderEntity order = orders.get(random.nextInt(orders.size()));
                if ("outbound".equals(order.getOrderType())) {
                    orderId = order.getId();
                }
            }
            
            String taskNumber = "PACK-" + String.format("%06d", i + 1);
            if (taskRepository.findByTaskNumber(taskNumber).isPresent()) {
                taskNumber = "PACK-" + String.format("%06d", i + 1) + "-" + System.currentTimeMillis();
            }
            Task task = new Task();
            task.setTaskNumber(taskNumber);
            task.setTaskType("packing");
            task.setWarehouseId(warehouse.getId());
            if (!workers.isEmpty() && random.nextBoolean()) {
                task.setAssignedTo(workers.get(random.nextInt(workers.size())).getId());
            }
            task.setPriority(random.nextBoolean() ? "normal" : "high");
            task.setStatus(random.nextBoolean() ? "pending" : (random.nextBoolean() ? "in_progress" : "completed"));
            task.setDueDate(LocalDateTime.now().plusDays(random.nextInt(3)));
            task.setReferenceType("order");
            task.setReferenceId(orderId);
            
            taskService.create(task);
            created++;
        }

        return created;
    }

    /**
     * Generate all synthetic data
     */
    @Transactional
    public GenerationResult generateAll(int suppliersCount, int couriersCount, int customersCount) {
        int suppliers = generateSuppliers(suppliersCount);
        int couriers = generateDeliveryPartners(couriersCount);
        int customers = generateCustomers(customersCount);

        return new GenerationResult(suppliers, couriers, customers, 0, 0);
    }

    /**
     * Generate all synthetic data including orders and tasks
     */
    @Transactional
    public GenerationResult generateAllWithOperations(
            int suppliersCount, int couriersCount, int customersCount,
            int inboundOrders, int outboundOrders,
            int pickingTasks, int putawayTasks, int packingTasks) {
        int suppliers = generateSuppliers(suppliersCount);
        int couriers = generateDeliveryPartners(couriersCount);
        int customers = generateCustomers(customersCount);
        int orders = generateOrders(inboundOrders, outboundOrders);
        int tasks = generateTasks(pickingTasks, putawayTasks, packingTasks);

        return new GenerationResult(suppliers, couriers, customers, orders, tasks);
    }

    public static class GenerationResult {
        private final int suppliersCreated;
        private final int couriersCreated;
        private final int customersCreated;
        private final int ordersCreated;
        private final int tasksCreated;

        public GenerationResult(int suppliersCreated, int couriersCreated, int customersCreated, 
                                int ordersCreated, int tasksCreated) {
            this.suppliersCreated = suppliersCreated;
            this.couriersCreated = couriersCreated;
            this.customersCreated = customersCreated;
            this.ordersCreated = ordersCreated;
            this.tasksCreated = tasksCreated;
        }

        public int getSuppliersCreated() { return suppliersCreated; }
        public int getCouriersCreated() { return couriersCreated; }
        public int getCustomersCreated() { return customersCreated; }
        public int getOrdersCreated() { return ordersCreated; }
        public int getTasksCreated() { return tasksCreated; }
    }
}

