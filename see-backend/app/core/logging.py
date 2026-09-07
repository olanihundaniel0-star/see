"""Structured logging configuration using loguru."""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from loguru import Logger


def configure_logging(log_level: str = "INFO", json_logs: bool = False) -> Logger:
    """
    Configure structured logging with loguru.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_logs: If True, output logs as JSON for structured logging systems
    
    Returns:
        Configured logger instance
    """
    # Remove default handler
    logger.remove()
    
    # Configure format
    if json_logs:
        # JSON format for production/structured logging systems
        log_format = (
            "{{\"time\": \"{time:YYYY-MM-DD HH:mm:ss.SSS}\", "
            "\"level\": \"{level}\", "
            "\"module\": \"{module}\", "
            "\"function\": \"{function}\", "
            "\"line\": {line}, "
            "\"message\": \"{message}\"}}"
        )
    else:
        # Human-readable format for development
        log_format = (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{module}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        )
    
    # Add handler with configuration
    logger.add(
        sys.stderr,
        format=log_format,
        level=log_level,
        colorize=not json_logs,
        backtrace=True,
        diagnose=True,
    )
    
    return logger


# Export configured logger
__all__ = ["configure_logging", "logger"]
