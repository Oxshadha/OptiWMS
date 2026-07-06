"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  analyticsApi,
  type AnalyticsPeriod,
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
  allOrdersChart: OrderChartData[];
  inventoryOverview: InventoryOverview | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

const initialState: DashboardDataState = {
  kpis: null,
  ordersChart: [],
  topProducts: [],
  allOrdersChart: [],
  inventoryOverview: null,
  loading: true,
  isRefreshing: false,
  error: null,
};

export function useDashboardData(options?: { topProductsLimit?: number; period?: AnalyticsPeriod }) {
  const topProductsLimit = options?.topProductsLimit ?? 4;
  const period = options?.period ?? "current_month";

  const fetchDashboardData = useCallback(async (): Promise<Omit<DashboardDataState, "loading" | "isRefreshing" | "error">> => {
    logger.debug("[Dashboard] Starting data fetch...");

    const token = localStorage.getItem("accessToken");
    logger.debug("[Dashboard] Token check:", token ? "Found" : "Not found");

    if (!token) {
      throw new Error("Not authenticated. Please login.");
    }

    const fetchWithTimeout = async <T,>(
      promise: Promise<T>,
      timeoutMs: number = 10000
    ): Promise<T> => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
      );
      return Promise.race([promise, timeout]);
    };

    const [kpisData, ordersChartData, allOrdersChartData, topProductsData, inventoryData] =
      await Promise.all([
        fetchWithTimeout(analyticsApi.getDashboardKPIs(undefined, period)).catch(
          (err) => {
            logger.error("[Dashboard] KPIs fetch error:", err);
            return null;
          }
        ),
        fetchWithTimeout(analyticsApi.getOrdersChart(period)).catch((err) => {
          logger.error("[Dashboard] Orders chart fetch error:", err);
          return [];
        }),
        fetchWithTimeout(analyticsApi.getOrdersChart("all")).catch((err) => {
          logger.error("[Dashboard] All-period orders chart fetch error:", err);
          return [];
        }),
        fetchWithTimeout(analyticsApi.getTopProducts(topProductsLimit, undefined, period)).catch((err) => {
          logger.error("[Dashboard] Top products fetch error:", err);
          return [];
        }),
        fetchWithTimeout(analyticsApi.getInventoryOverview()).catch((err) => {
          logger.error("[Dashboard] Inventory overview fetch error:", err);
          return null;
        }),
      ]);

    return {
      kpis: kpisData,
      ordersChart: ordersChartData,
      allOrdersChart: allOrdersChartData,
      topProducts: topProductsData,
      inventoryOverview: inventoryData,
    };
  }, [period, topProductsLimit]);

  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard", period, topProductsLimit],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    select: (data) => ({
      kpis: data.kpis,
      ordersChart: data.ordersChart,
      topProducts: data.topProducts,
      allOrdersChart: data.allOrdersChart,
      inventoryOverview: data.inventoryOverview,
    }),
  });

  const errorMessage =
    dashboardQuery.error instanceof Error
      ? dashboardQuery.error.message
      : dashboardQuery.error
        ? "Failed to load dashboard data"
        : null;

  return {
    ...(dashboardQuery.data ?? initialState),
    loading: dashboardQuery.isPending && !dashboardQuery.data,
    isRefreshing: dashboardQuery.isFetching && !dashboardQuery.isPending,
    error: errorMessage,
    reload: dashboardQuery.refetch,
  };
}
