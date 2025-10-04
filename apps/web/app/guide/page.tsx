"use server"

import { redirect } from "next/navigation";


export default async function GuideLandingPage({}) {
 return redirect("/guide/getting-started");
}
