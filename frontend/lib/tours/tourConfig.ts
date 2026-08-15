export interface TourStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: "top" | "bottom" | "left" | "right";
    align?: "start" | "center" | "end";
  };
  /** Navigate here before the step runs, for tours that cross pages. */
  route?: string;
  /** Selector to click first, e.g. to open the dialog the step points at. */
  clickBefore?: string;
}

export interface TourConfig {
  showProgress?: boolean;
  steps: TourStep[];
}

export const tours: Record<string, TourConfig> = {
  dashboard_overview_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-dashboard"]',
        popover: {
          title: "Dashboard",
          description:
            "This is your command center. Get a quick snapshot of orders, inventory health, and operations here.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="kpi-orders-card"]',
        popover: {
          title: "Orders KPI Card",
          description:
            "Track how many orders came in during the selected period. Use the dropdown at the top to change the time window.",
          side: "bottom",
        },
      },
      {
        element: '[data-tour-target="kpi-orders-chart"]',
        popover: {
          title: "Orders Trend Chart",
          description:
            "See orders created per day. Quickly spot busy days and slow periods.",
          side: "bottom",
        },
      },
      {
        element: '[data-tour-target="inventory-overview"]',
        popover: {
          title: "Inventory Health",
          description:
            "Monitor total items, low-stock warnings, and out-of-stock situations in one glance.",
          side: "top",
        },
      },
      {
        element: '[data-tour-target="top-products"]',
        popover: {
          title: "Top Moving Products",
          description:
            "Fastest-moving SKUs appear here so you can prioritise restocking.",
          side: "left",
        },
      },
      {
        element: '[data-tour-target="ai-assistant-btn"]',
        popover: {
          title: "Warehouse Assistant AI",
          description:
            "Ask anything: stock numbers, SOPs, reports, or even UI tours like this one!",
          side: "top",
          align: "end",
        },
      },
    ],
  },

  inventory_management_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-inventory"]',
        popover: {
          title: "Inventory Section",
          description:
            "Click here to open the inventory page where you can search, filter, and manage all stock.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="inventory-search"]',
        popover: {
          title: "Search Inventory",
          description:
            "Type a SKU, product name, or keyword to instantly filter the stock list.",
          side: "bottom",
        },
      },
      {
        element: '[data-tour-target="inventory-filters"]',
        popover: {
          title: "Stock & Type Filters",
          description:
            "Narrow down by item type (raw material, product) or stock status (low / available).",
          side: "bottom",
        },
      },
      {
        element: '[data-tour-target="inventory-add-btn"]',
        popover: {
          title: "Add Stock Item",
          description:
            "Use this button to create a new inventory record or receive stock into the warehouse.",
          side: "left",
        },
      },
      {
        element: '[data-tour-target="inventory-table"]',
        popover: {
          title: "Inventory Table",
          description:
            "Click any row for details, edit quantity, assign a bin location, or adjust the reorder point.",
          side: "top",
        },
      },
      {
        element: '[data-tour-target="inventory-overview"]',
        popover: {
          title: "Stock Health Overview",
          description:
            "Back on the dashboard, this panel flags low and out-of-stock items at a glance.",
          side: "top",
        },
      },
    ],
  },

  // Task tour: walks the actual create flow rather than naming the menus around
  // it. Steps navigate and open the wizard, so the anchors do not exist when the
  // tour starts -- the engine resolves them as it goes.
  create_inbound_order_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-orders-inbound"]',
        popover: {
          title: "Inbound Orders",
          description:
            "Inbound orders record stock arriving from a supplier. Let's open the page.",
          side: "right",
        },
      },
      {
        route: "/admin/orders/inbound",
        element: '[data-tour-target="inbound-create-button"]',
        popover: {
          title: "Start a new order",
          description:
            "This opens the create wizard. You will need the supplier, the receiving warehouse and the expected arrival date.",
          side: "bottom",
        },
      },
      {
        route: "/admin/orders/inbound",
        clickBefore: '[data-tour-target="inbound-create-button"]',
        element: '[data-tour-target="inbound-create-modal"]',
        popover: {
          title: "Four steps to submit",
          description:
            "Supplier and warehouse, then the items and quantities, then the receiving locations, and finally a review before you submit. You can move back at any point without losing what you entered.",
          side: "left",
        },
      },
    ],
  },

  orders_and_shipments_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-orders"]',
        popover: {
          title: "Orders Menu",
          description:
            "Expand here for Inbound (POs / receiving) and Outbound (SOs / shipping) order flows.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-orders-inbound"]',
        popover: {
          title: "Inbound Orders",
          description:
            "Manage purchase orders, goods receiving, and put-away tasks here.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-orders-outbound"]',
        popover: {
          title: "Outbound Orders",
          description:
            "Track sales orders, picking queues, packing, and final shipment.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-shipments"]',
        popover: {
          title: "Shipments",
          description:
            "Dive into shipment manifests, carrier tracking, and proof of delivery.",
          side: "right",
        },
      },
    ],
  },

  warehouse_layout_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-warehouses"]',
        popover: {
          title: "Warehouses Menu",
          description:
            "Access the interactive warehouse layout, racks, and live route control.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-pathfinding"]',
        popover: {
          title: "Live Route Control",
          description:
            "Visualise optimal paths for pickers between bin locations in real time.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-slotting"]',
        popover: {
          title: "Slotting Plans",
          description:
            "Let AI recommend the best bin for each SKU based on velocity, size, and seasonality.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-materials"]',
        popover: {
          title: "Product Catalog",
          description:
            "Define material master data, dimensions, and assign default bin locations.",
          side: "right",
        },
      },
    ],
  },

  reports_analytics_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-forecasts"]',
        popover: {
          title: "Demand Forecasts",
          description:
            "AI-powered demand predictions drive replenishment and slotting decisions.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-reports"]',
        popover: {
          title: "Export Reports",
          description:
            "Generate structured PDF reports for KPIs, stock movement, and operations.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-labor-productivity"]',
        popover: {
          title: "Labor Productivity",
          description:
            "Analyse picker rates, task completion times, and team performance.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="kpi-orders-chart"]',
        popover: {
          title: "Orders Bar Chart",
          description:
            "Dashboard charts update live. Ask the AI assistant for a custom PDF report at any time.",
          side: "bottom",
        },
      },
      {
        element: '[data-tour-target="ai-assistant-btn"]',
        popover: {
          title: "Ask for Reports",
          description:
            'Try saying: "Generate a PDF report for top 10 products by movement this month."',
          side: "top",
          align: "end",
        },
      },
    ],
  },

  workforce_tasks_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-tasks"]',
        popover: {
          title: "Task Center",
          description:
            "See all picking, packing, cycle count, and put-away tasks with status and assignee.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-workers"]',
        popover: {
          title: "Workers",
          description:
            "Manage warehouse staff, roles, and check who is clocked in or on break.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-packing"]',
        popover: {
          title: "Packing Station",
          description:
            "Monitor packing lines, scan boxes, print labels, and confirm weight.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-cycle-counts"]',
        popover: {
          title: "Cycle Counts",
          description:
            "Schedule and reconcile perpetual stock counts without freezing operations.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-labor-productivity"]',
        popover: {
          title: "Productivity Dashboard",
          description:
            "Track KPIs per worker, per shift, and per task type.",
          side: "right",
        },
      },
    ],
  },

  sop_help_tour: {
    showProgress: true,
    steps: [
      {
        element: '[data-tour-target="nav-sops"]',
        popover: {
          title: "SOP Library",
          description:
            "All warehouse standard operating procedures — forklift safety, damaged goods, PPT usage, and more.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="nav-help"]',
        popover: {
          title: "Help Center",
          description:
            "Step-by-step guides, feature documentation, and contact support.",
          side: "right",
        },
      },
      {
        element: '[data-tour-target="topbar-notifications"]',
        popover: {
          title: "Notifications",
          description:
            "Alerts for low stock, task assignments, and important system events.",
          side: "bottom",
        },
      },
      {
        element: '[data-tour-target="topbar-search"]',
        popover: {
          title: "Global Search",
          description:
            "Quickly jump to a specific warehouse, order, or customer record.",
          side: "bottom",
        },
      },
      {
        element: '[data-tour-target="ai-assistant-btn"]',
        popover: {
          title: "Ask the Warehouse Assistant",
          description:
            'Stuck? Ask things like "What is the forklift safety SOP?" or "Show me how to use inventory."',
          side: "top",
          align: "end",
        },
      },
    ],
  },
};
