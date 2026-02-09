"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy Raw Materials page - redirects to unified Materials page
 * Maintained for backward compatibility
 */
export default function RawMaterialsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified materials page with raw_material filter
    router.replace("/admin/materials?type=raw_material");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  );
}
