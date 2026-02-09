package com.optiwms.coreapi.auth;

import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // username can be actual username, email, or employee ID
        Optional<UserEntity> userEntity = userRepository.findByUsername(username);
        
        if (userEntity.isEmpty()) {
            // Try to find by email
            userEntity = userRepository.findByEmail(username);
        }
        
        if (userEntity.isEmpty()) {
            // Try to find by employee ID
            userEntity = userRepository.findByEmployeeId(username);
        }
        
        if (userEntity.isEmpty()) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        UserEntity user = userEntity.get();
        
        // Check if user is active
        if (!"active".equalsIgnoreCase(user.getStatus())) {
            throw new UsernameNotFoundException("User is not active: " + username);
        }

        // Build UserDetails with password hash
        // The password hash should already be in BCrypt format
        return User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .roles(user.getRole().toUpperCase())
                .build();
    }

    public UserDetails loadUserByEmail(String email) throws UsernameNotFoundException {
        Optional<UserEntity> userEntity = userRepository.findByEmail(email);
        
        if (userEntity.isEmpty()) {
            throw new UsernameNotFoundException("User not found with email: " + email);
        }

        UserEntity user = userEntity.get();
        
        if (!"active".equalsIgnoreCase(user.getStatus())) {
            throw new UsernameNotFoundException("User is not active: " + email);
        }

        return User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .roles(user.getRole().toUpperCase())
                .build();
    }
}

