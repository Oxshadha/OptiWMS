"use client";

import React from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { WarehouseAssistantFullPage } from "@/components/WarehouseAssistant";

// The page renders the WarehouseAssistant in full-screen mode.
export default function AssistantPage() {
  const { admin } = useAdmin();
  return <WarehouseAssistantFullPage userRole="manager" userId={admin?.id} />;
}
