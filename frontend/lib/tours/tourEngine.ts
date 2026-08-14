import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { tours } from "./tourConfig";

export const startProductTour = (tourId: string) => {
  const tourConfig = tours[tourId as keyof typeof tours];
  if (!tourConfig) {
    console.warn(`Tour with ID ${tourId} not found.`);
    return;
  }

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

  const driverObj = driver({
    showProgress: true,
    steps,
  });

  // Small timeout to ensure DOM is ready and chat widget has processed
  setTimeout(() => {
    driverObj.drive();
  }, 300);
};
