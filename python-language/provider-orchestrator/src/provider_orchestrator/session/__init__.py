"""
Session-broker pattern (abstract).

Models: account → stored credentials → upstream call wrapper →
auth-failure marking. No site-specific protocols included.
"""

from provider_orchestrator.session.broker import SessionBroker, AccountSession, UpstreamCall

__all__ = ["SessionBroker", "AccountSession", "UpstreamCall"]
