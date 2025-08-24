import { timestamp, customType } from "drizzle-orm/pg-core";
import { customAlphabet } from 'nanoid';

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

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
export const generateNanoid = customAlphabet(alphabet, 16);

export const nanoidType = customType<{ data: string; driverData: string; default: true }>({
  dataType() {
    return "text";
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: string): string {
    return value;
  },
});

export const nanoid = (name: string) => 
  nanoidType(name).notNull().$defaultFn(() => generateNanoid());

