"use client";

import clsx from "clsx";

interface SummaryCard {
  label: string;
  value: string | number;
  icon: string;
  color?: "primary" | "success" | "warning" | "error" | "info";
  onClick?: () => void;
}

interface SummaryCardsProps {
  cards: SummaryCard[];
  columns?: 2 | 3 | 4;
}

const colorClasses = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
};

export function SummaryCards({ cards, columns = 4 }: SummaryCardsProps) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  };

  return (
    <div className={`grid grid-cols-1 ${gridCols[columns]} gap-4`}>
      {cards.map((card, index) => (
        <div
          key={index}
          className={clsx(
            "card bg-base-100 border border-base-300 rounded-xl p-4",
            card.onClick && "cursor-pointer hover:shadow-lg transition-shadow"
          )}
          onClick={card.onClick}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">{card.label}</div>
              <div className={clsx(
                "text-2xl font-bold",
                card.color ? colorClasses[card.color] : "text-base-content"
              )}>
                {card.value}
              </div>
            </div>
            <span className={clsx(
              "material-symbols-outlined text-3xl",
              card.color ? colorClasses[card.color] : "text-primary"
            )}>
              {card.icon}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

