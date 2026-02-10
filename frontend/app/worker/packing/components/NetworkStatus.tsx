interface NetworkStatusProps {
  isOnline: boolean;
}

export function NetworkStatus({ isOnline }: NetworkStatusProps) {
  return (
    <div className={`alert ${isOnline ? "alert-success" : "alert-warning"}`}>
      <span className="material-symbols-outlined">{isOnline ? "wifi" : "wifi_off"}</span>
      <span>{isOnline ? "Online" : "Offline Mode"}</span>
    </div>
  );
}
