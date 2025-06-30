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
    if (Buffer.isBuffer(value)) {
      return value;
    }
    
    if (value && typeof value === 'object' && 'buffer' in value) {
      return Buffer.from(value as Uint8Array);
    }
    
    if (typeof value === 'string' && value.startsWith('\\x')) {
      return Buffer.from(value.slice(2), 'hex');
    }
    
    return Buffer.from(value as any);
  },
}); 