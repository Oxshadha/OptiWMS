"use client";

import React from "react";
import { WarehouseAssistantFullPage } from "@/components/WarehouseAssistant";

// The page renders the WarehouseAssistant in full-screen mode.
export default function AssistantPage() {
  return <WarehouseAssistantFullPage userRole="manager" />;
}
