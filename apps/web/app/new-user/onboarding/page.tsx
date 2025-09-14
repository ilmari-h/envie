import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../auth/helpers";
import { db, Schema } from "@repo/db";
import { eq } from "drizzle-orm";

export default async function OnboardingPage() {

  const user = await getAuthenticatedUser();
  if(!user) {
    return redirect("/new-user");
  }

  // If user already has a paid plan, redirect to done page
  const userData = await db.query.users.findFirst({
    where: eq(Schema.users.id, user.userId),

  })
  console.log(userData);
  if(userData && userData.maxOrganizations > 1) {
    return redirect("/dashboard");
  }

  return redirect("/new-user/onboarding/organization")
}