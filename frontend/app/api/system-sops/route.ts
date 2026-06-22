import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    // process.cwd() is c:\Users\User\Documents\GitHub\OptiWMS\frontend
    let docsDir = path.resolve(process.cwd(), "../ai_services/ai-agent/docs");

    if (!fs.existsSync(docsDir)) {
      // Fallback to local SOP Documents if the other directory doesn't exist
      docsDir = path.resolve(process.cwd(), "SOP Documents");
    }

    if (!fs.existsSync(docsDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(docsDir);
    const textFiles = files.filter((f) => f.endsWith(".txt"));

    const sops = textFiles.map((filename) => {
      const filePath = path.join(docsDir, filename);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      // Parse title as first non-empty line
      const lines = fileContent.split(/\r?\n/).map((l) => l.trim());
      const firstLine = lines.find((l) => l.length > 0) || "";

      // Clean the title (e.g. remove "SOP:" prefix if present)
      const title = firstLine.replace(/^(SOP:\s*)/i, "").trim() || filename.replace(/\.txt$/i, "");

      // Map filename to SOPCategory
      let category = "general";
      const lowerFilename = filename.toLowerCase();
      if (
        lowerFilename.includes("forklift") ||
        lowerFilename.includes("stacker") ||
        lowerFilename.includes("pallet truck")
      ) {
        category = "equipment_operation";
      } else if (lowerFilename.includes("cycle count")) {
        category = "cycle_count";
      } else if (
        lowerFilename.includes("unloading") ||
        lowerFilename.includes("pallet purchasing")
      ) {
        category = "warehouse_operations";
      } else if (lowerFilename.includes("safekeeping") || lowerFilename.includes("safety")) {
        category = "safety";
      } else if (lowerFilename.includes("inspection")) {
        category = "inspection";
      }

      // Read file stats for timestamps
      const stats = fs.statSync(filePath);
      const updatedAt = stats.mtime.toISOString().split("T")[0];
      const createdAt = stats.birthtime.toISOString().split("T")[0];

      return {
        id: `system-${filename.replace(/\s+/g, "-").replace(/\.txt$/i, "").toLowerCase()}`,
        title,
        category,
        content: fileContent, // Keep whole file content to show title/meta sections inside the viewer
        version: "1.0",
        status: "active",
        createdBy: "AI Agent",
        applicableRoles: ["admin", "worker"],
        createdAt,
        updatedAt,
        isSystem: true,
      };
    });

    return NextResponse.json(sops);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
