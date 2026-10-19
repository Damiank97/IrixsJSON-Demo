import { notFound } from "next/navigation";
import Link from "next/link";
import { loadConnector, loadAllIds } from "@/lib/data";
import { ConnectorDetailView } from "@/components/ConnectorDetailView";

export async function generateStaticParams() {
  const ids = await loadAllIds();
  return ids.map((id) => ({ id }));
}

export default async function ConnectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadConnector(id);
  if (!detail) notFound();

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-accent text-white shadow-[0_8px_30px_rgba(52,12,70,0.12)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid h-10 w-10 place-items-center rounded-xl bg-brand-yellow font-mono text-sm font-bold text-accent">IX</Link>
            <div>
              <p className="text-sm font-semibold">Irixs Toolbox</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.2em] text-white/70">JSON Schemabank</p>
            </div>
          </div>
          <Link href="/" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">
            ← Terug naar overzicht
          </Link>
        </div>
      </header>

      <ConnectorDetailView detail={detail} />
    </main>
  );
}
