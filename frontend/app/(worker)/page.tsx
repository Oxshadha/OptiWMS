"use client";

import Link from "next/link";

export default function WorkerHome() {
  const widgets = [
    // Row 1
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
    // Row 2
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
    // Row 3
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
    // Row 4
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
    <div 
      className="w-full"
      style={{ 
        padding: "0.5rem",
        background: "oklch(98% 0 0)",
        minHeight: "100%",
        boxSizing: "border-box"
      }}
    >
      <div 
        className="grid grid-cols-2"
        style={{
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          height: "100%"
        }}
      >
        {widgets.map((widget) => (
          <Link
            key={widget.id}
            href={widget.href}
            className="active:scale-95 transition-transform"
            style={{
              borderRadius: "0.75rem",
              padding: "0.625rem",
              background: "rgb(238, 238, 238)",
              color: "oklch(21% 0.006 285.885)",
              cursor: "pointer",
              transition: "transform 0.15s",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: "0",
              aspectRatio: "1",
              textDecoration: "none",
              boxSizing: "border-box",
              WebkitTapHighlightColor: "transparent"
            }}
          >
            <div style={{
              fontSize: "0.625rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              opacity: 0.6,
              marginBottom: "0.5rem",
              fontWeight: 600,
              color: "oklch(21% 0.006 285.885)",
              lineHeight: "1.2"
            }}>
              {widget.header}
            </div>
            <div style={{
              fontSize: "2rem",
              marginBottom: "0.25rem",
              color: "#CF0F47",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "1"
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "2rem" }}>
                {widget.icon}
              </span>
            </div>
            <div style={{ marginTop: "auto" }}>
              <div style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "oklch(21% 0.006 285.885)",
                lineHeight: "1.2"
              }}>
                {widget.title}
              </div>
              <div style={{
                fontSize: "0.625rem",
                opacity: 0.5,
                marginTop: "0.125rem",
                color: "oklch(21% 0.006 285.885)",
                lineHeight: "1.2"
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
