import type { PackagingType } from "./types";

export const packagingTypes: PackagingType[] = [
  { id: "small", name: "Small Box", dimensions: { length: 20, width: 15, height: 10 }, maxWeight: 5 },
  { id: "medium", name: "Medium Box", dimensions: { length: 30, width: 25, height: 20 }, maxWeight: 15 },
  { id: "large", name: "Large Box", dimensions: { length: 40, width: 35, height: 30 }, maxWeight: 30 },
  { id: "polymailer", name: "Poly Mailer", dimensions: { length: 25, width: 20, height: 2 }, maxWeight: 2 },
  { id: "crate", name: "Crate", dimensions: { length: 50, width: 40, height: 40 }, maxWeight: 50 },
];

export const dunnageOptions = ["Bubble Wrap", "Air Pillows", "Peanuts", "Foam", "Paper"];
