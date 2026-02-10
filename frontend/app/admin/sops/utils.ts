import { SOP, SOP_CATEGORIES } from "./types";

export function buildSOPMarkdown(sop: SOP): string {
  return `# ${sop.title}

**Category:** ${SOP_CATEGORIES[sop.category]}  
**Version:** ${sop.version}  
**Status:** ${sop.status}  
**Last Updated:** ${sop.updatedAt}  
**Created:** ${sop.createdAt}  
**Created By:** ${sop.createdBy}

---

${sop.content}
`;
}

export function downloadSOPAsMarkdown(sop: SOP): void {
  const content = buildSOPMarkdown(sop);
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sop.title.replace(/[^a-z0-9]/gi, "_")}_v${sop.version}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
