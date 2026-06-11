package com.church.cms.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Shared Jackson ObjectMapper bean used by both Spring MVC message converters
 * and internal components (e.g. MemberAuditAspect).
 *
 * Marked @Primary so Spring MVC picks this up as the HTTP serializer,
 * ensuring @JsonIgnoreProperties on entities is honoured on all endpoints.
 */
@Configuration
public class JacksonConfig {

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // Java 8 date/time support
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Don't fail on unknown properties coming in from clients
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        // Don't fail when serializing entities with bidirectional relationships
        // (@JsonIgnoreProperties on entities handles the cycle-breaking)
        mapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);

        // Omit null fields from JSON output for cleaner API responses
        mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);

        return mapper;
    }
}
