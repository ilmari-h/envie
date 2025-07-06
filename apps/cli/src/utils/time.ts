export function parseExpiryDate(dateString: string): Date {
  const match = dateString.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) {
    throw new Error('Invalid date format. Use YYYY-MM-DD format (e.g., "2024-12-31")');
  }

  const date = new Date(dateString + 'T23:59:59.999Z');
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date. Please provide a valid date in YYYY-MM-DD format');
  }

  const now = new Date();
  if (date <= now) {
    throw new Error('Expiry date must be in the future');
  }

  return date;
}