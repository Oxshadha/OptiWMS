import httpx


class WmsClient:
    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=timeout)

    def health(self) -> dict:
        # Replace with real WMS health endpoint when available.
        return {"wms_base_url": self.base_url, "status": "configured"}
