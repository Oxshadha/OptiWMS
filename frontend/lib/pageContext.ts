/**
 * What the user is currently looking at, so the assistant does not have to be told.
 *
 * The route alone comes free from the router, but "why is this one low?" needs the
 * selected entity too. A page publishes that with a single `usePublishPageContext`
 * call; everything else -- subscribing, sending, clearing on navigation -- happens
 * in the assistant.
 *
 * Deliberately a module-level store rather than React context: the assistant lives
 * in Topbar and the worker layout, far outside any page's provider tree, so a
 * provider would have to wrap the whole app to reach it.
 */
import { useEffect } from "react";

export type PageContext = {
  /** Route the user is on, filled in by the assistant. */
  route?: string;
  /** What kind of thing is selected, e.g. "material", "slotting_plan", "policy_line". */
  entityType?: string;
  /** Business identifier, e.g. a material code. Not a UUID -- the assistant
   *  reasons in the codes people use. */
  entityId?: string;
  /** Human label for the entity, shown to the user so they can see what is attached. */
  entityLabel?: string;
  /** Anything else that narrows the view, e.g. { horizon: 3, month: "2026-03" }. */
  filters?: Record<string, string | number | boolean | null>;
};

let current: PageContext = {};
const listeners = new Set<(ctx: PageContext) => void>();

export function setPageContext(next: PageContext): void {
  current = next ?? {};
  listeners.forEach((listener) => listener(current));
}

export function clearPageContext(): void {
  setPageContext({});
}

export function getPageContext(): PageContext {
  return current;
}

export function subscribePageContext(listener: (ctx: PageContext) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Publish what this page has selected. Clears on unmount so a stale material
 * cannot follow the user to another screen.
 *
 * `filters` is stringified for the dependency list because callers naturally pass
 * an object literal, which is a new reference on every render.
 */
export function usePublishPageContext(context: PageContext): void {
  const filterKey = JSON.stringify(context.filters ?? null);
  useEffect(() => {
    setPageContext({
      entityType: context.entityType,
      entityId: context.entityId,
      entityLabel: context.entityLabel,
      filters: context.filters,
    });
    return clearPageContext;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.entityType, context.entityId, context.entityLabel, filterKey]);
}
