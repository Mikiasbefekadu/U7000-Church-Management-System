package com.church.cms.service;

import com.church.cms.dto.auth.LoginRequest;
import com.church.cms.dto.auth.LoginResponse;
import com.church.cms.entity.User;
import com.church.cms.repository.UserRepository;
import com.church.cms.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        // Throws BadCredentialsException if invalid — Spring Security handles the 401
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.username());
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Embed role and scope claims into the token for client-side routing
        Map<String, Object> extraClaims = Map.of(
                "role", user.getRole(),
                "zoneId", user.getAssignedZone() != null ? user.getAssignedZone().getZoneId() : "",
                "kcuId",  user.getAssignedKcu()  != null ? String.valueOf(user.getAssignedKcu().getKcuId()) : ""
        );

        String token = jwtUtil.generateToken(userDetails, extraClaims);

        return new LoginResponse(
                token,
                user.getUserId(),
                user.getUsername(),
                user.getRole(),
                user.getAssignedZone() != null ? user.getAssignedZone().getZoneId() : null,
                user.getAssignedKcu()  != null ? String.valueOf(user.getAssignedKcu().getKcuId()) : null
        );
    }
}
