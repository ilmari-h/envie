import { pgTable, timestamp, customType } from "drizzle-orm/pg-core";

export const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}

export const bytea = customType<{ data: Buffer; driverData: string }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): string {
    return `\\x${value.toString('hex')}`;
  },
  fromDriver(value: unknown): Buffer {
    // Handle Buffer or Uint8Array directly
    if (Buffer.isBuffer(value)) return value;
    if (value && typeof value === 'object' && 'buffer' in value) {
      return Buffer.from(value as Uint8Array);
    }
    
    // If it's a string, handle the hex case
    if (typeof value === 'string') {
      const hex = value.startsWith('\\x') ? value.substring(2) : value;
      return Buffer.from(hex, 'hex');
    }
    
    // Last resort - try to convert whatever we got
    return Buffer.from(value as any);
  },
}); 