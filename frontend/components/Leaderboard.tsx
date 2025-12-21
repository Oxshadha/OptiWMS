"use client";

import { LeaderboardEntry } from "@/lib/api/analytics";
import clsx from "clsx";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  showBadges?: boolean;
  maxEntries?: number;
}

export function Leaderboard({ entries, showBadges = true, maxEntries = 10 }: LeaderboardProps) {
  const displayEntries = entries.slice(0, maxEntries);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getTrendIcon = (trend: LeaderboardEntry["trend"]) => {
    switch (trend) {
      case "up":
        return "📈";
      case "down":
        return "📉";
      default:
        return "➡️";
    }
  };

  const getBadgeColor = (badge?: string) => {
    if (!badge) return "";
    if (badge.includes("Top")) return "badge-warning";
    if (badge.includes("Perfect")) return "badge-success";
    if (badge.includes("Speed")) return "badge-primary";
    return "badge-info";
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-xl">Leaderboard</h2>
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Worker</th>
                <th>Role</th>
                <th>PPH</th>
                <th>Tasks</th>
                <th>Error Rate</th>
                {showBadges && <th>Badges</th>}
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((entry) => (
                <tr key={entry.workerId} className={entry.rank <= 3 ? "bg-base-200" : ""}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{getRankIcon(entry.rank)}</span>
                      {entry.rank > 3 && (
                        <span className="text-sm text-base-content/60">{entry.rank}</span>
                      )}
                    </div>
                  </td>
                  <td className="font-semibold">{entry.workerName}</td>
                  <td>
                    <span className="badge badge-outline badge-sm">{entry.role}</span>
                  </td>
                  <td>
                    <span className="font-bold text-primary">{entry.picksPerHour.toFixed(1)}</span>
                  </td>
                  <td>{entry.tasksCompleted}</td>
                  <td>
                    <span
                      className={clsx(
                        "badge badge-sm",
                        entry.errorRate < 1 ? "badge-success" : entry.errorRate < 3 ? "badge-warning" : "badge-error"
                      )}
                    >
                      {entry.errorRate.toFixed(1)}%
                    </span>
                  </td>
                  {showBadges && (
                    <td>
                      {entry.badge && (
                        <span className={clsx("badge badge-sm", getBadgeColor(entry.badge))}>
                          {entry.badge}
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    <span className="text-lg" title={entry.trend}>
                      {getTrendIcon(entry.trend)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <div className="text-center py-8 text-base-content/60">
              No leaderboard data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

