import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../auth/helpers";
import { getDb, Schema } from "@repo/db";
import { eq } from "drizzle-orm";
import { env } from "../../env";

export default async function OnboardingPage() {

  const user = await getAuthenticatedUser();
  if(!user) {
    return redirect("/new-user");
  }

  const db = getDb(env.DATABASE_URL);

  // If user already has a paid plan, redirect to done page
  const userData = await db.query.users.findFirst({
    where: eq(Schema.users.id, user.userId),

  })
  if(userData && userData.maxOrganizations > 1) {
    return redirect("/dashboard");
  }

  return redirect("/new-user/onboarding/organization")
}