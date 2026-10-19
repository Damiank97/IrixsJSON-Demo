import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/siteAuth";
import { DashboardStudio } from "@/components/studio/DashboardStudio";
import "./studio.css";

export const metadata = { title: "Dashboard Studio · Irixs" };
export default async function StudioPage() {
  const jar = await cookies();
  const internal = await verifySessionToken(jar.get(SESSION_COOKIE)?.value, process.env.SITE_PASSWORD_HASH ?? "");
  return <DashboardStudio internal={internal} />;
}
