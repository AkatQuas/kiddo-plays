class VoiceException(Exception):
    def __init__(self, status_code: int, detail: str, headers: dict | None = None):
        self.status_code = status_code
        self.detail = detail
        self.headers = headers or {}
        super().__init__(detail)

    def __str__(self):
        return f"VoiceException({self.status_code}): {self.detail}"

    def __repr__(self):
        return (
            f"VoiceException(status_code={self.status_code}, "
            f"detail={self.detail!r}, headers={self.headers})"
        )


class DuplicateVoiceError(Exception):
    def __init__(self, voice_name: str):
        self.voice_name = voice_name
        super().__init__(f"Voice name already exists: {voice_name}")
