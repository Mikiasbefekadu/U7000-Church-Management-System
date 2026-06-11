package com.church.cms.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.Ordered;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

/**
 * Creates the audit_log PostgreSQL schema and member_audit table before
 * Hibernate's EntityManagerFactory is initialized.
 *
 * Uses BeanDefinitionRegistryPostProcessor (runs very early in the Spring
 * lifecycle, before any beans are instantiated) to ensure the schema exists
 * before Hibernate's ddl-auto=update or ddl-auto=validate runs.
 *
 * Direct JDBC is used here because the DataSource bean is not yet available
 * at this point in the lifecycle.
 */
@Slf4j
@Component
public class AuditSchemaInitializer
        implements BeanDefinitionRegistryPostProcessor, EnvironmentAware, Ordered {

    private Environment environment;

    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry)
            throws BeansException {
        createAuditSchema();
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory)
            throws BeansException {
        // nothing needed here
    }

    private void createAuditSchema() {
        String url      = environment.getProperty("spring.datasource.url");
        String username = environment.getProperty("spring.datasource.username");
        String password = environment.getProperty("spring.datasource.password");

        if (url == null || username == null) {
            log.warn("[AuditSchemaInitializer] Datasource properties not available — skipping.");
            return;
        }

        try (Connection conn = DriverManager.getConnection(url, username, password);
             Statement stmt = conn.createStatement()) {

            stmt.execute("CREATE SCHEMA IF NOT EXISTS audit_log");
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS audit_log.member_audit (
                    audit_id    BIGSERIAL    PRIMARY KEY,
                    member_id   VARCHAR(50)  NOT NULL,
                    changed_by  VARCHAR(100) NOT NULL,
                    changed_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
                    operation   VARCHAR(20)  NOT NULL,
                    diff_json   JSONB        NOT NULL
                )
                """);
            stmt.execute(
                "CREATE INDEX IF NOT EXISTS idx_member_audit_member " +
                "ON audit_log.member_audit(member_id)");
            stmt.execute(
                "CREATE INDEX IF NOT EXISTS idx_member_audit_time " +
                "ON audit_log.member_audit(changed_at)");

            log.info("[AuditSchemaInitializer] audit_log schema and member_audit table ensured.");
        } catch (Exception e) {
            log.error("[AuditSchemaInitializer] Failed to initialize audit schema: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to initialize audit_log schema", e);
        }
    }
}
