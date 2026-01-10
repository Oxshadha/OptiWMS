"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy Products page - redirects to unified Materials page
 * Maintained for backward compatibility
 */
export default function ProductsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified materials page with product filter
    router.replace("/admin/materials?type=product");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  );
}
