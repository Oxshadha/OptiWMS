import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { tours } from "./tourConfig";

export const startProductTour = (tourId: string) => {
  const tourConfig = tours[tourId as keyof typeof tours];
  if (!tourConfig) {
    console.warn(`Tour with ID ${tourId} not found.`);
    return;
  }

  // Sub-item anchors are only mounted while their nav group is open, so ask the
  // sidebar to expand everything first. Without this, every sub-item step is
  // dropped below and a five-step tour silently becomes two.
  window.dispatchEvent(new CustomEvent("optiwms:tour-expand-nav"));

  // The expand is a React state update, so the anchors do not exist until the
  // next render. Filter and start after that, which also lets the chat widget
  // settle before the first highlight.
  setTimeout(() => {
    // Navigation changes over time, so a step may point at an anchor that is no
    // longer rendered. Drop those rather than showing an unanchored popover.
    const steps = tourConfig.steps.filter((step) => {
      if (!step.element || typeof step.element !== "string") return true;
      return document.querySelector(step.element) !== null;
    });

    if (steps.length === 0) {
      console.warn(`Tour ${tourId} has no visible targets on this page.`);
      return;
    }

    driver({ showProgress: true, steps }).drive();
  }, 300);
};
