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
      {/* Header */}
      <header className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-display text-2xl tracking-tightest text-accent hover:opacity-70 transition-opacity">
              Irixs
            </Link>
            <span className="text-muted text-xs uppercase tracking-[0.2em]">Schemabank</span>
          </div>
          <Link href="/" className="text-xs text-muted hover:text-accent transition-colors">
            ← Terug naar overzicht
          </Link>
        </div>
      </header>

      <ConnectorDetailView detail={detail} />
    </main>
  );
}
