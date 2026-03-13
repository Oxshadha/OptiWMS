import httpx


class WmsClient:
    def __init__(self, base_url: str, token: str | None = None, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self._client = httpx.Client(timeout=timeout)

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def health(self) -> dict:
        return {"wms_base_url": self.base_url, "status": "configured"}

    def get_inventory(self, sku: str | None = None) -> dict:
        url = f"{self.base_url}/inventory"
        params = {"sku": sku} if sku else None
        r = self._client.get(url, params=params, headers=self._headers())
        r.raise_for_status()
        return r.json()
