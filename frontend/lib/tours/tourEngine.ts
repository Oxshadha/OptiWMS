import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { tours } from "./tourConfig";

export const startProductTour = (tourId: string) => {
  const tourConfig = tours[tourId as keyof typeof tours];
  if (!tourConfig) {
    console.warn(`Tour with ID ${tourId} not found.`);
    return;
  }

  const driverObj = driver({
    showProgress: true,
    steps: tourConfig.steps,
  });

  // Small timeout to ensure DOM is ready and chat widget has processed
  setTimeout(() => {
    driverObj.drive();
  }, 300);
};
