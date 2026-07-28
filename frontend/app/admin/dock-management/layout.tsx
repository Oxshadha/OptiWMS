import { notFound } from "next/navigation";

/**
 * Dock/yard management is intentionally outside the active OptiWMS scope.
 *
 * Keep the dormant page source recoverable, but mask the root page and every
 * nested detail route from direct browser navigation.
 */
export default function DisabledDockManagementLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  void children;
  notFound();
}
