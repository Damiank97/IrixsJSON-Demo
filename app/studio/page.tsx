import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/siteAuth";
import { DataWorkbench } from "@/components/bi/DataWorkbench";
import "./studio.css";
import "./data/workbench.css";

export const metadata = { title: "Studio · Irixs" };
export default async function StudioPage() {
  const jar = await cookies();
  const internal = await verifySessionToken(jar.get(SESSION_COOKIE)?.value, process.env.SITE_PASSWORD_HASH ?? "");
  return <DataWorkbench internal={internal} />;
}
