"""
Environment-specific configuration for See backend.

Three environments:
- development: Local testing, debug enabled, relaxed security
- staging: Pre-production testing, production-like config, some debug
- production: Live environment, security hardened, monitoring enabled
"""

from typing import Literal

EnvironmentType = Literal["development", "staging", "production"]


class EnvironmentConfig:
    """Base configuration for all environments."""

    # Core
    DEBUG: bool
    LOG_LEVEL: str
    ENVIRONMENT: EnvironmentType

    # Database
    DATABASE_CONNECTION_RETRIES: int
    DATABASE_POOL_SIZE: int
    DATABASE_MAX_OVERFLOW: int
    DATABASE_POOL_RECYCLE: int

    # Redis
    REDIS_CONNECTION_RETRIES: int

    # API
    CORS_ALLOW_CREDENTIALS: bool
    API_RATE_LIMIT_ENABLED: bool
    API_RATE_LIMIT_REQUESTS_PER_MINUTE: int

    # Security
    ENFORCE_HTTPS: bool
    SECURE_COOKIES: bool
    CORS_ORIGINS_STRICT: bool

    # External APIs
    GEMINI_TIMEOUT_SECONDS: int
    GMAIL_TIMEOUT_SECONDS: int

    # Monitoring & Error Tracking
    SENTRY_ENABLED: bool
    SENTRY_TRACE_SAMPLE_RATE: float
    ERROR_LOGGING_ENABLED: bool

    # Features
    FEATURES_EMAIL_POLLING: bool
    FEATURES_WEBHOOK_INGESTION: bool


class DevelopmentConfig(EnvironmentConfig):
    """Development environment configuration."""

    DEBUG = True
    LOG_LEVEL = "DEBUG"
    ENVIRONMENT = "development"

    # Database - smaller pool for local dev
    DATABASE_CONNECTION_RETRIES = 3
    DATABASE_POOL_SIZE = 5
    DATABASE_MAX_OVERFLOW = 10
    DATABASE_POOL_RECYCLE = 3600

    # Redis
    REDIS_CONNECTION_RETRIES = 3

    # API
    CORS_ALLOW_CREDENTIALS = True
    API_RATE_LIMIT_ENABLED = False  # Disable rate limiting in dev
    API_RATE_LIMIT_REQUESTS_PER_MINUTE = 1000

    # Security - relaxed for development
    ENFORCE_HTTPS = False
    SECURE_COOKIES = False
    CORS_ORIGINS_STRICT = False

    # External APIs
    GEMINI_TIMEOUT_SECONDS = 30
    GMAIL_TIMEOUT_SECONDS = 20

    # Monitoring
    SENTRY_ENABLED = False
    SENTRY_TRACE_SAMPLE_RATE = 0.0
    ERROR_LOGGING_ENABLED = True

    # Features - all enabled for testing
    FEATURES_EMAIL_POLLING = True
    FEATURES_WEBHOOK_INGESTION = True


class StagingConfig(EnvironmentConfig):
    """Staging environment configuration (pre-production testing)."""

    DEBUG = False
    LOG_LEVEL = "INFO"
    ENVIRONMENT = "staging"

    # Database - production-like but with retries for stability
    DATABASE_CONNECTION_RETRIES = 5
    DATABASE_POOL_SIZE = 15
    DATABASE_MAX_OVERFLOW = 30
    DATABASE_POOL_RECYCLE = 3600

    # Redis
    REDIS_CONNECTION_RETRIES = 5

    # API
    CORS_ALLOW_CREDENTIALS = True
    API_RATE_LIMIT_ENABLED = True
    API_RATE_LIMIT_REQUESTS_PER_MINUTE = 500

    # Security - production-like but with some slack for testing
    ENFORCE_HTTPS = True
    SECURE_COOKIES = True
    CORS_ORIGINS_STRICT = True

    # External APIs
    GEMINI_TIMEOUT_SECONDS = 30
    GMAIL_TIMEOUT_SECONDS = 20

    # Monitoring - sample traces for investigation
    SENTRY_ENABLED = True
    SENTRY_TRACE_SAMPLE_RATE = 0.1  # 10% of transactions
    ERROR_LOGGING_ENABLED = True

    # Features - all enabled
    FEATURES_EMAIL_POLLING = True
    FEATURES_WEBHOOK_INGESTION = True


class ProductionConfig(EnvironmentConfig):
    """Production environment configuration (live, hardened)."""

    DEBUG = False
    LOG_LEVEL = "WARNING"
    ENVIRONMENT = "production"

    # Database - optimized for production
    DATABASE_CONNECTION_RETRIES = 10
    DATABASE_POOL_SIZE = 20
    DATABASE_MAX_OVERFLOW = 40
    DATABASE_POOL_RECYCLE = 3600

    # Redis
    REDIS_CONNECTION_RETRIES = 10

    # API
    CORS_ALLOW_CREDENTIALS = True
    API_RATE_LIMIT_ENABLED = True
    API_RATE_LIMIT_REQUESTS_PER_MINUTE = 300  # Strict rate limiting

    # Security - hardened for production
    ENFORCE_HTTPS = True
    SECURE_COOKIES = True
    CORS_ORIGINS_STRICT = True

    # External APIs
    GEMINI_TIMEOUT_SECONDS = 20
    GMAIL_TIMEOUT_SECONDS = 15

    # Monitoring - full traces for production issues
    SENTRY_ENABLED = True
    SENTRY_TRACE_SAMPLE_RATE = 0.05  # 5% of transactions
    ERROR_LOGGING_ENABLED = True

    # Features - all enabled
    FEATURES_EMAIL_POLLING = True
    FEATURES_WEBHOOK_INGESTION = True


def get_environment_config(env: EnvironmentType) -> EnvironmentConfig:
    """Get configuration class for environment."""
    configs = {
        "development": DevelopmentConfig,
        "staging": StagingConfig,
        "production": ProductionConfig,
    }

    config_class = configs.get(env)
    if not config_class:
        raise ValueError(f"Unknown environment: {env}. Must be one of: {list(configs.keys())}")

    return config_class()
