"use client";

import React from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { WarehouseAssistantFullPage } from "@/components/WarehouseAssistant";

export default function AdminAssistantPage() {
  const { admin } = useAdmin();
  return <WarehouseAssistantFullPage userRole="manager" userId={admin?.id} />;
}
