import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { tours } from "./tourConfig";

/**
 * Extra behaviour a tour step may request beyond highlighting.
 *
 * `route` moves to a page before the step runs, and `clickBefore` activates a
 * control the next step depends on -- opening a modal, for example. Without
 * these a tour can only point at whatever the current screen already shows,
 * which is why task tours previously stopped at the sidebar.
 */
type TourStep = DriveStep & {
  route?: string;
  clickBefore?: string;
};

const waitForElement = (selector: string, timeoutMs = 4000): Promise<Element | null> =>
  new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const started = Date.now();
    const timer = window.setInterval(() => {
      const found = document.querySelector(selector);
      if (found || Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(found);
      }
    }, 100);
  });

export const startProductTour = (tourId: string, navigate?: (path: string) => void) => {
  const tourConfig = tours[tourId as keyof typeof tours];
  if (!tourConfig) {
    console.warn(`Tour with ID ${tourId} not found.`);
    return;
  }

  // Sub-item anchors are only mounted while their nav group is open, so ask the
  // sidebar to expand everything first. Without this, every sub-item step is
  // dropped below and a five-step tour silently becomes two.
  window.dispatchEvent(new CustomEvent("optiwms:tour-expand-nav"));

  const steps = tourConfig.steps as TourStep[];

  const run = async () => {
    // Steps that navigate or open something cannot be validated up front: their
    // targets do not exist yet. Only filter the plain ones.
    const staged = steps.filter((step) => {
      if (step.route || step.clickBefore) return true;
      if (!step.element || typeof step.element !== "string") return true;
      return document.querySelector(step.element) !== null;
    });

    if (staged.length === 0) {
      console.warn(`Tour ${tourId} has no visible targets on this page.`);
      return;
    }

    const driverObj = driver({
      showProgress: true,
      steps: staged,
      onHighlightStarted: async (_element, step) => {
        const current = step as TourStep;
        if (current.route && window.location.pathname !== current.route) {
          navigate?.(current.route);
          if (typeof current.element === "string") await waitForElement(current.element);
        }
        if (current.clickBefore) {
          const trigger = document.querySelector<HTMLElement>(current.clickBefore);
          trigger?.click();
          if (typeof current.element === "string") await waitForElement(current.element);
        }
      },
    });

    driverObj.drive();
  };

  // The nav expand is a React state update, so anchors do not exist until the
  // next render. This also lets the chat widget settle before the first
  // highlight.
  setTimeout(() => void run(), 300);
};
