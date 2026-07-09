import Link from 'next/link';
import { getBuildsFile, getStatus, timeAgo, money } from '@/lib/builds';
import type { BuildStatus } from '@/lib/types';

const statusLabel: Record<BuildStatus, string> = {
  complete: 'Complete',
  in_progress: 'In progress',
  pending: 'Queued',
};

export default function Home() {
  const { totals, builds, generated_at } = getBuildsFile();
  const run = getStatus();

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <div className="logo">🎬</div>
          <div>
            <h1>AI-YouTube · Build Dashboard</h1>
            <p>Progress &amp; cost of every AI-generated story video</p>
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
          <div className="k">Stories</div>
          <div className="v">{totals.builds}</div>
        </div>
        <div className="stat">
          <div className="k">Videos built</div>
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

      <p className="section-label">Builds</p>
      <div className="cards">
        {builds.map((b) => {
          const pct = Math.round((b.progress.done / b.progress.total) * 100);
          return (
            <Link href={`/build/${b.id}`} key={b.id} className="card">
              <div className="card-top">
                <div>
                  <h3>{b.title}</h3>
                  {b.theme && <div className="theme">{b.theme}</div>}
                </div>
                <span className={`badge ${b.status}`}>
                  <span className="dot" />
                  {statusLabel[b.status]}
                </span>
              </div>

              <div className="card-meta">
                <span>
                  <b>{b.scene_count}</b> scenes
                </span>
                <span>
                  <b>{b.word_count.toLocaleString()}</b> words
                </span>
                {b.video.duration_seconds ? (
                  <span>
                    <b>{Math.round(b.video.duration_seconds / 60)}</b> min video
                  </span>
                ) : null}
                <span>
                  cost <b>{money(b.cost.actual_usd)}</b>{' '}
                  <span style={{ color: 'var(--faint)' }}>(≈ {money(b.cost.equivalent_usd)} paid)</span>
                </span>
                {b.upload.uploaded && b.upload.url ? (
                  <span>
                    <b style={{ color: 'var(--green)' }}>▶ uploaded</b>
                  </span>
                ) : null}
              </div>

              <div className="progress">
                <div className="progress-track">
                  <div
                    className={`progress-fill ${b.status === 'complete' ? 'complete' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="progress-labels">
                  <span>
                    {b.progress.done} / {b.progress.total} steps
                  </span>
                  <span>{pct}%</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="cost-note" style={{ marginTop: 28 }}>
        Actual spend is <b>$0</b> — the pipeline runs on free tiers (Gemini free, edge-tts, local FFmpeg). The
        &ldquo;≈ paid&rdquo; figure estimates what the same work would cost on paid APIs.
      </p>
    </main>
  );
}
