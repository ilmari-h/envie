import { db, Schema } from '@repo/db';
import { eq, desc, asc } from 'drizzle-orm';

export const getEnvironmentVersionByIndex = async (environmentId: string, versionIndex?: string) => {
  if (!versionIndex) {
    return db.query.environmentVersions.findFirst({
      where: eq(Schema.environmentVersions.environmentId, environmentId),
      orderBy: desc(Schema.environmentVersions.createdAt),
      with: {
        keys: true
      }
    });
  }
  const versionNumber = parseInt(versionIndex, 10);
  if (isNaN(versionNumber)) return null;

  return db.query.environmentVersions.findFirst({
    where: eq(Schema.environmentVersions.environmentId, environmentId),
    orderBy: asc(Schema.environmentVersions.createdAt),
    offset: versionNumber - 1,
    with: {
      keys: true
    }
  });
};
