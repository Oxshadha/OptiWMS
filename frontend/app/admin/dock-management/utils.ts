export const getStatusColor = (status: string): string => {
  switch (status) {
    case "available":
      return "badge-success";
    case "occupied":
      return "badge-error";
    case "reserved":
      return "badge-warning";
    case "maintenance":
      return "badge-error";
    case "scheduled":
      return "badge-info";
    case "in_progress":
      return "badge-primary";
    case "completed":
      return "badge-success";
    case "waiting":
      return "badge-warning";
    case "assigned":
      return "badge-info";
    default:
      return "badge-outline";
  }
};

export const formatTime = (dateString?: string | null): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const getDaysInMonth = (month: number, year: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (month: number, year: number): number => {
  return new Date(year, month, 1).getDay();
};

export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
