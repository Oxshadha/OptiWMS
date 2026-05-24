const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/api$/, '');

export async function fetchWarehouses() {
  const res = await fetch(`${API_BASE}/api/master/warehouses`, {
    cache: "no-store",
    headers: {
      // For now assume basic auth against dev backend
      Authorization: "Basic " + btoa("admin:admin123"),
    },
  });
  if (!res.ok) throw new Error("Failed to load warehouses");
  return res.json() as Promise<{ id: number; code: string; name: string; status: string }[]>;
}


