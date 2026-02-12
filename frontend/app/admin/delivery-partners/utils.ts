export const formatCurrency = (amount: number, currencyCode?: string): string => {
  const code = currencyCode || "USD";
  switch (code.toUpperCase()) {
    case "LKR":
      return `Rs. ${amount.toFixed(2)}`;
    case "USD":
      return `$${amount.toFixed(2)}`;
    case "EUR":
      return `€${amount.toFixed(2)}`;
    case "GBP":
      return `£${amount.toFixed(2)}`;
    case "INR":
      return `₹${amount.toFixed(2)}`;
    default:
      return `${code} ${amount.toFixed(2)}`;
  }
};
