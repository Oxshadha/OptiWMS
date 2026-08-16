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
    if (rank === 1) return "looks_one";
    if (rank === 2) return "looks_two";
    if (rank === 3) return "looks_3";
    return null;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-500"; // Gold
    if (rank === 2) return "text-slate-400";  // Silver
    if (rank === 3) return "text-amber-600";  // Bronze
    return "text-base-content/60";
  };

  const getTrendIcon = (trend: LeaderboardEntry["trend"]) => {
    switch (trend) {
      case "up":
        return "trending_up";
      case "down":
        return "trending_down";
      default:
        return "trending_flat";
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
        <div className="overflow-x-auto overflow-y-auto max-h-[32rem]">
          <table className="table table-zebra">
            <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
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
                      {getRankIcon(entry.rank) ? (
                        <span className={`material-symbols-outlined text-xl font-bold ${getRankColor(entry.rank)}`}>
                          {getRankIcon(entry.rank)}
                        </span>
                      ) : null}
                      <span className={`text-base font-bold ${getRankColor(entry.rank)}`}>
                        #{entry.rank}
                      </span>
                    </div>
                  </td>
                  <td className="font-semibold">{entry.workerName}</td>
                  <td>
                    <span className="badge badge-outline badge-sm">{entry.role}</span>
                  </td>
                  <td>
                    <span className="font-bold text-primary">{(entry.picksPerHour ?? 0).toFixed(1)}</span>
                  </td>
                  <td>{entry.tasksCompleted}</td>
                  <td>
                    <span
                      className={clsx(
                        "badge badge-sm",
                        (entry.errorRate ?? 0) < 1 ? "badge-success" : (entry.errorRate ?? 0) < 3 ? "badge-warning" : "badge-error"
                      )}
                    >
                      {(entry.errorRate ?? 0).toFixed(1)}%
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
                    <span 
                      className={`material-symbols-outlined text-lg ${
                        entry.trend === "up" ? "text-success" : 
                        entry.trend === "down" ? "text-error" : 
                        "text-base-content/60"
                      }`}
                      title={entry.trend}
                    >
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
