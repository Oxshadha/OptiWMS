# Project-Scoped Rules for OptiWMS

## Guided Product Tours
OptiWMS uses `driver.js` for guided product tours. The tours are triggered by the AI assistant and rely on stable DOM selectors to highlight elements on the screen.

**Crucial Rule for Frontend Modification:**
1. **Preserve Attributes**: When refactoring or modifying frontend components, you MUST preserve any existing `data-tour-target="..."` attributes.
2. **Add Attributes**: When creating new major interactive elements (such as navigation links, primary action buttons, or important form inputs), proactively add a descriptive `data-tour-target` attribute (e.g., `data-tour-target="create-order-btn"`). This ensures future tours can easily target these elements without relying on brittle CSS classes or element hierarchy.
