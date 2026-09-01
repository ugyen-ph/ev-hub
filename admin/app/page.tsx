const STATUS_LEGEND: Array<{ label: string; color: string }> = [
  { label: "Available", color: "#10B981" },
  { label: "Reserved", color: "#F59E0B" },
  { label: "Busy / Charging", color: "#EF4444" },
  { label: "Offline", color: "#9CA3AF" },
];

const PLANNED_PAGES = [
  { n: "1", title: "Live Monitor", desc: "Every charger in the network, updating in real time" },
  { n: "2", title: "Stations", desc: "Add/edit stations, set locations on a map" },
  { n: "3", title: "Chargers", desc: "Connector types, power ratings, status control" },
  { n: "4", title: "Reservations", desc: "All bookings with no-show handling" },
  { n: "5", title: "Analytics", desc: "Utilization, peak hours, energy delivered" },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="flex items-center gap-3 border-b border-black/5 bg-white px-8 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-xl text-white">
          ⚡
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">EV Hub Admin</h1>
          <p className="text-sm text-black/50">Bhutan&apos;s EV Charging Network — operator console</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-8 py-10">
        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Session 1 scaffold complete ✅</h2>
          <p className="mt-2 max-w-2xl text-black/60">
            The dashboard shell, brand tokens and status palette are in place. The Live Monitor —
            fed by Supabase Realtime — is built in Session 6, right after the database and mobile
            app are live.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {STATUS_LEGEND.map(({ label, color }) => (
              <span
                key={label}
                className="flex items-center gap-2 rounded-full bg-black/[.04] px-3 py-1.5 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/40">
            Planned pages
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLANNED_PAGES.map(({ n, title, desc }) => (
              <div key={n} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-sm font-semibold text-brand">
                  {n}
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-black/55">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-8 py-6 text-center text-xs text-black/40">
        Demo data today · real charger data arrives with the BPC partnership (OCPP-ready schema)
      </footer>
    </div>
  );
}
