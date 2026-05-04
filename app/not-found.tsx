import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="text-center max-w-md">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted mb-4">404</p>
        <h1 className="font-display text-6xl text-ink mb-6 tracking-tightest">
          Niet <em className="text-accent">gevonden</em>.
        </h1>
        <p className="text-muted mb-8 leading-relaxed">
          Deze connector zit niet in de schemabank — wellicht is hij hernoemd
          of verwijderd uit de OASContent repository.
        </p>
        <Link
          href="/"
          className="inline-block text-sm border border-accent text-accent px-5 py-2.5 hover:bg-accent hover:text-canvas transition-colors"
        >
          Terug naar overzicht
        </Link>
      </div>
    </main>
  );
}
