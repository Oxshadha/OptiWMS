"use client";

import Link from "next/link";

export default function WorkerHome() {
  const widgets = [
    // Row 1: Receiving, Putaway
    {
      id: 1,
      header: "RECEIVING",
      title: "Receiving",
      subtitle: "Tap to open",
      icon: "input",
      href: "/worker/receiving",
    },
    {
      id: 2,
      header: "PUTAWAY",
      title: "Putaway",
      subtitle: "Tap to open",
      icon: "inventory_2",
      href: "/worker/putaway",
    },
    // Row 2: Picking, Cycle Count
    {
      id: 3,
      header: "PICKING",
      title: "Picking",
      subtitle: "Tap to open",
      icon: "shopping_cart",
      href: "/worker/picking",
    },
    {
      id: 4,
      header: "CYCLE COUNT",
      title: "Cycle Count",
      subtitle: "Tap to open",
      icon: "autorenew",
      href: "/worker/cycle-count",
    },
    // Row 3: Stock Transfer, Packing
    {
      id: 5,
      header: "STOCK TRANSFER",
      title: "Stock Transfer",
      subtitle: "Tap to open",
      icon: "swap_horiz",
      href: "/worker/stock-transfer",
    },
    {
      id: 6,
      header: "PACKING",
      title: "Packing",
      subtitle: "Tap to open",
      icon: "inventory",
      href: "/worker/packing",
    },
    // Row 4: Shipment, Returns
    {
      id: 7,
      header: "SHIPMENTS",
      title: "Shipments",
      subtitle: "Tap to open",
      icon: "local_shipping",
      href: "/worker/shipments",
    },
    {
      id: 8,
      header: "RETURNS",
      title: "Returns",
      subtitle: "Tap to open",
      icon: "keyboard_return",
      href: "/worker/returns",
    },
  ];

  return (
    <div style={{ 
      flex: 1, 
      padding: "1.5rem", 
      background: "oklch(98% 0 0)" 
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem"
      }}>
        {widgets.map((widget) => (
          <Link
            key={widget.id}
            href={widget.href}
            style={{
              borderRadius: "1rem",
              padding: "1.5rem",
              background: "rgb(238, 238, 238)",
              color: "oklch(21% 0.006 285.885)",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: "160px",
              textDecoration: "none"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              opacity: 0.6,
              marginBottom: "1rem",
              fontWeight: 600,
              color: "oklch(21% 0.006 285.885)"
            }}>
              {widget.header}
            </div>
            <div style={{
              fontSize: "3rem",
              marginBottom: "0.75rem",
              color: "#CF0F47"
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "3rem" }}>
                {widget.icon}
              </span>
            </div>
            <div style={{ marginTop: "auto" }}>
              <div style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "oklch(21% 0.006 285.885)"
              }}>
                {widget.title}
              </div>
              <div style={{
                fontSize: "0.85rem",
                opacity: 0.5,
                marginTop: "0.25rem",
                color: "oklch(21% 0.006 285.885)"
              }}>
                {widget.subtitle}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
