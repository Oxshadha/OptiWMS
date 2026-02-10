"use client";

import { useCallback, useEffect, useState } from "react";
import {
  analyticsApi,
  DashboardKPIs,
  InventoryOverview,
  OrderChartData,
  TopProduct,
} from "@/lib/api/analytics";
import { logger } from "@/lib/utils/logger";

interface DashboardDataState {
  kpis: DashboardKPIs | null;
  ordersChart: OrderChartData[];
  topProducts: TopProduct[];
  inventoryOverview: InventoryOverview | null;
  loading: boolean;
  error: string | null;
}

const initialState: DashboardDataState = {
  kpis: null,
  ordersChart: [],
  topProducts: [],
  inventoryOverview: null,
  loading: true,
  error: null,
};

export function useDashboardData() {
  const [state, setState] = useState<DashboardDataState>(initialState);

  const fetchDashboardData = useCallback(async () => {
    logger.debug("[Dashboard] Starting data fetch...");

    // Wait briefly for auth bootstrap.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const token = localStorage.getItem("accessToken");
    logger.debug("[Dashboard] Token check:", token ? "Found" : "Not found");

    if (!token) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Not authenticated. Please login.",
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const fetchWithTimeout = async <T,>(
        promise: Promise<T>,
        timeoutMs: number = 10000
      ): Promise<T> => {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
        );
        return Promise.race([promise, timeout]);
      };

      const [kpisData, ordersChartData, topProductsData, inventoryData] =
        await Promise.all([
          fetchWithTimeout(analyticsApi.getDashboardKPIs(undefined, "monthly")).catch(
            (err) => {
              logger.error("[Dashboard] KPIs fetch error:", err);
              return null;
            }
          ),
          fetchWithTimeout(analyticsApi.getOrdersChart("daily")).catch((err) => {
            logger.error("[Dashboard] Orders chart fetch error:", err);
            return [];
          }),
          fetchWithTimeout(analyticsApi.getTopProducts(4)).catch((err) => {
            logger.error("[Dashboard] Top products fetch error:", err);
            return [];
          }),
          fetchWithTimeout(analyticsApi.getInventoryOverview()).catch((err) => {
            logger.error("[Dashboard] Inventory overview fetch error:", err);
            return null;
          }),
        ]);

      setState({
        kpis: kpisData,
        ordersChart: ordersChartData,
        topProducts: topProductsData,
        inventoryOverview: inventoryData,
        loading: false,
        error: null,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load dashboard data";

      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      if (
        errorMessage.includes("Not authenticated") ||
        errorMessage.includes("Session expired")
      ) {
        window.location.href = "/admin/login";
      }
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!state.loading) {
      return;
    }

    const timeout = setTimeout(() => {
      setState((prev) => {
        const hasAnyData =
          !!prev.kpis ||
          prev.ordersChart.length > 0 ||
          prev.topProducts.length > 0 ||
          !!prev.inventoryOverview;

        if (hasAnyData) {
          return { ...prev, loading: false };
        }

        return {
          ...prev,
          loading: false,
          error:
            "Dashboard data failed to load. Please check your connection and try again.",
        };
      });
    }, 15000);

    return () => clearTimeout(timeout);
  }, [state.loading, state.kpis, state.ordersChart, state.topProducts, state.inventoryOverview]);

  return {
    ...state,
    reload: fetchDashboardData,
  };
}

