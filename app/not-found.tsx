import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-8">
      <div className="tool-card max-w-lg p-8 text-center md:p-12">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent font-mono text-sm font-bold text-brand-yellow">IX</span>
        <p className="mt-7 font-mono text-xs uppercase tracking-[0.25em] text-brand-yellow-dark">404</p>
        <h1 className="mb-5 mt-3 text-4xl font-semibold tracking-tightest text-accent">
          Pagina niet gevonden
        </h1>
        <p className="text-muted mb-8 leading-relaxed">
          Deze connector zit niet in de schemabank — wellicht is hij hernoemd
          of verwijderd uit de OASContent repository.
        </p>
        <Link
          href="/"
          className="tool-button-primary"
        >
          Terug naar overzicht
        </Link>
      </div>
    </main>
  );
}
