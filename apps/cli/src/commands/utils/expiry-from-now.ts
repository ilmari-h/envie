export class ExpiryFromNow {
  private expiryDate: Date;

  constructor(textFormat: string) {
    if (!this.isValidDurationFormat(textFormat)) {
      throw new Error('Invalid duration format. Expected format: [0-9]+(ms|s|m|h|d|w|y) e.g. "5m", "1h30m", "90d"');
    }

    const ms = this.parseDuration(textFormat);
    this.expiryDate = new Date(Date.now() + ms);
  }

  private isValidDurationFormat(text: string): boolean {
    return /^(\d+[mshdwy])+$/i.test(text);
  }

  private parseDuration(text: string): number {
    const units: { [key: string]: number } = {
      'ms': 1,
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'y': 365 * 24 * 60 * 60 * 1000
    };

    let totalMs = 0;
    const matches = text.matchAll(/(\d+)([mshdwy])/gi);
    
    for (const match of matches) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      totalMs += value * units[unit];
    }

    return totalMs;
  }

  public toDate(): Date {
    return this.expiryDate;
  }
}

