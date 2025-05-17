import { timestamp, customType } from "drizzle-orm/pg-core";

export const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: unknown): Buffer {
    // Handle Buffer from Postgres (starts with \x)
    if (Buffer.isBuffer(value)) {
      const str = value.toString();
      if (str.startsWith('\\x')) {
        return Buffer.from(str.slice(2), 'hex');
      }
      return value;
    }
    if (value && typeof value === 'object' && 'buffer' in value) {
      return Buffer.from(value as Uint8Array);
    }
    
    // Last resort - try to convert whatever we got
    return Buffer.from(value as any);
  },
}); 