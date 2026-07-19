import Link from 'next/link';
import { getBuildsFile, getStatus, timeAgo, money, boardColumns, brandOf, BRANDS } from '@/lib/builds';

export default function Home({ searchParams }: { searchParams?: { brand?: string } }) {
  const { totals, builds, generated_at } = getBuildsFile();
  const run = getStatus();
  const brandFilter = searchParams?.brand;
  const columns = boardColumns(builds, brandFilter);

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <div className="logo">🎬</div>
          <div>
            <h1>AI-YouTube · Production Board</h1>
            <p>Every AI-generated video, tracked across the pipeline</p>
          </div>
        </div>
        <div className="run-status">
          {run.run_url ? (
            <a href={run.run_url} target="_blank" rel="noreferrer" className={`runstat ${run.status}`}>
              <span className="dot" /> daily run {run.status}
            </a>
          ) : (
            <span className={`runstat ${run.status}`}>
              <span className="dot" /> daily run {run.status}
            </span>
          )}
          <div className="stamp">{run.last_run_at ? `${timeAgo(run.last_run_at)} · synced` : 'not run yet'}</div>
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="k">Videos</div>
          <div className="v">{totals.builds}</div>
        </div>
        <div className="stat">
          <div className="k">Rendered</div>
          <div className="v">
            {totals.videos} <small>/ {totals.builds}</small>
          </div>
        </div>
        <div className="stat">
          <div className="k">Total runtime</div>
          <div className="v">
            {totals.total_minutes}
            <small> min</small>
          </div>
        </div>
        <div className="stat free">
          <div className="k">Actual spend</div>
          <div className="v">{money(totals.actual_usd)}</div>
        </div>
      </section>

      <div className="board-toolbar">
        <nav className="tabs">
          <Link href="/" className={`tab ${!brandFilter ? 'on' : ''}`}>All brands</Link>
          {BRANDS.map((b) => (
            <Link key={b.key} href={`/?brand=${b.key}`} className={`tab ${brandFilter === b.key ? 'on' : ''}`}>
              <span>{b.emoji}</span> {b.label}
            </Link>
          ))}
        </nav>
        <Link href="/assets" className="tab asset-link">🧩 Asset Library</Link>
      </div>

      <div className="board">
        {columns.map(({ stage, builds: colBuilds }) => (
          <section className="column" key={stage.key}>
            <header className="col-head">
              <span className="col-title">{stage.label}</span>
              <span className="col-count">{colBuilds.length}</span>
            </header>
            <div className="col-body">
              {colBuilds.length === 0 ? (
                <div className="col-empty">—</div>
              ) : (
                colBuilds.map((b) => {
                  const pct = b.progress.total ? Math.round((b.progress.done / b.progress.total) * 100) : 0;
                  const br = brandOf(b);
                  return (
                    <Link href={`/build/${b.id}`} key={b.id} className="kcard">
                      <div className="kcard-brand" title={br.label}>
                        <span>{br.emoji}</span>
                        {b.format && <span className="fmt">{b.format}</span>}
                      </div>
                      <h3>{b.title}</h3>
                      <div className="kcard-meta">
                        {b.scene_count ? <span>{b.scene_count} scenes</span> : null}
                        {b.video.duration_seconds ? <span>{Math.round(b.video.duration_seconds)}s</span> : null}
                        <span>{money(b.cost.actual_usd)}</span>
                      </div>
                      <div className="kbar">
                        <div className={`kbar-fill ${b.status === 'complete' ? 'complete' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="kcard-foot">
                        <span>{b.progress.done}/{b.progress.total}</span>
                        {b.upload.uploaded ? <span className="up">▶ live</span> : <span className="date">{b.date.slice(5)}</span>}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="cost-note" style={{ marginTop: 24 }}>
        Cards flow left → right through the pipeline; each sits in the stage currently being worked.
        Actual spend is <b>$0</b> on the free-tier text pipeline — the Veo video stage (ASMR brand) is
        the first paid step and is billed per second of generated video.
      </p>
    </main>
  );
}
