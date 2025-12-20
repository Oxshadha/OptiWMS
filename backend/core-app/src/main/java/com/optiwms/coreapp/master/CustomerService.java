package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Customer;
import com.optiwms.infra.master.CustomerEntity;
import com.optiwms.infra.master.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CustomerService {

    private final CustomerRepository repository;

    public CustomerService(CustomerRepository repository) {
        this.repository = repository;
    }

    public List<Customer> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Customer findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Customer not found: " + id));
    }

    @Transactional
    public Customer create(Customer customer) {
        if (customer.getCode() != null && repository.existsByCode(customer.getCode())) {
            throw new RuntimeException("Customer code already exists: " + customer.getCode());
        }

        CustomerEntity entity = new CustomerEntity();
        entity.setCode(customer.getCode());
        entity.setName(customer.getName());
        entity.setEmail(customer.getEmail());
        entity.setPhone(customer.getPhone());
        entity.setAddress(customer.getAddress());
        entity.setCity(customer.getCity());
        entity.setCountry(customer.getCountry() != null ? customer.getCountry() : "Sri Lanka");
        entity.setStatus(customer.getStatus() != null ? customer.getStatus() : "active");

        CustomerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Customer update(UUID id, Customer customer) {
        CustomerEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Customer not found: " + id));

        if (customer.getCode() != null && !entity.getCode().equals(customer.getCode())) {
            if (repository.existsByCode(customer.getCode())) {
                throw new RuntimeException("Customer code already exists: " + customer.getCode());
            }
        }

        entity.setCode(customer.getCode());
        entity.setName(customer.getName());
        entity.setEmail(customer.getEmail());
        entity.setPhone(customer.getPhone());
        entity.setAddress(customer.getAddress());
        entity.setCity(customer.getCity());
        entity.setCountry(customer.getCountry());
        entity.setStatus(customer.getStatus());

        CustomerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Customer not found: " + id);
        }
        repository.deleteById(id);
    }

    private Customer toDomain(CustomerEntity entity) {
        Customer customer = new Customer();
        customer.setId(entity.getId());
        customer.setCode(entity.getCode());
        customer.setName(entity.getName());
        customer.setEmail(entity.getEmail());
        customer.setPhone(entity.getPhone());
        customer.setAddress(entity.getAddress());
        customer.setCity(entity.getCity());
        customer.setCountry(entity.getCountry());
        customer.setStatus(entity.getStatus());
        return customer;
    }
}

