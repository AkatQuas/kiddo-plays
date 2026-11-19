"""
Educational proxy helpers.

Residential / datacenter proxy rotation is a networking technique useful for
learning about egress IP diversity, health screening, and sticky sessions.
It is provided for study and discussion only — not as a commercial product
feature, and not as guidance for violating third-party terms of service.
"""

from provider_orchestrator.proxy.pool import ProxyPool, ProxyEndpoint

__all__ = ["ProxyPool", "ProxyEndpoint"]
