import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBuilds, getBuild, money, fmtDuration } from '@/lib/builds';
import type { BuildStatus } from '@/lib/types';

export function generateStaticParams() {
  return getBuilds().map((b) => ({ id: b.id }));
}

const statusLabel: Record<BuildStatus, string> = {
  complete: 'Complete',
  in_progress: 'In progress',
  pending: 'Queued',
};

export default function BuildPage({ params }: { params: { id: string } }) {
  const b = getBuild(decodeURIComponent(params.id));
  if (!b) notFound();

  const pct = Math.round((b.progress.done / b.progress.total) * 100);

  return (
    <main>
      <Link href="/" className="back">
        ← All builds
      </Link>

      <div className="detail-head">
        <div>
          <h1>{b.title}</h1>
        </div>
        <span className={`badge ${b.status}`}>
          <span className="dot" />
          {statusLabel[b.status]} · {pct}%
        </span>
      </div>
      {b.moral && <p className="moral">&ldquo;{b.moral}&rdquo;</p>}

      <div className="grid-2">
        {/* --- steps --- */}
        <div className="panel">
          <h2>Pipeline steps · {b.progress.done}/{b.progress.total}</h2>
          <div className="timeline">
            {b.steps.map((s) => (
              <div className="tl-row" key={s.key}>
                <div className="tl-mark">
                  <div className={`tl-dot ${s.status}`}>{s.status === 'done' ? '✓' : ''}</div>
                </div>
                <div className="tl-body">
                  <div className="m">MODULE {s.module}</div>
                  <div className="l">{s.label}</div>
                  <div className="e">{s.engine}</div>
                </div>
                <div className="tl-detail">
                  <span className={`st ${s.status}`}>{s.status}</span>
                  {s.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- cost + info --- */}
        <div className="stack">
          <div className="panel">
            <h2>Cost to generate</h2>
            <div className="cost-hero">
              <div className="big">{money(b.cost.actual_usd)}</div>
              <div className="sub">actual spend · free tier</div>
              <div className="eq">
                ≈ <b>{money(b.cost.equivalent_usd)}</b> if run on paid APIs
              </div>
            </div>
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>≈ paid</th>
                </tr>
              </thead>
              <tbody>
                {b.cost.breakdown.map((c) => (
                  <tr key={c.step}>
                    <td>
                      {c.label}
                      {c.detail ? <div className="cd">{c.detail}</div> : null}
                    </td>
                    <td>{money(c.equivalent_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="cost-note">
              Everything runs on free tiers, so real spend is $0. The right column estimates the equivalent paid-API
              cost (Gemini text/image pricing; neural TTS rate — edge-tts is free).
            </p>
          </div>

          <div className="panel">
            <h2>Video &amp; output</h2>
            <dl className="kv">
              <dt>Status</dt>
              <dd>{b.video.has_final ? 'rendered' : 'not yet'}</dd>
              <dt>Duration</dt>
              <dd>{fmtDuration(b.video.duration_seconds)}</dd>
              {b.video.resolution && (
                <>
                  <dt>Resolution</dt>
                  <dd>{b.video.resolution}</dd>
                </>
              )}
              {b.video.size_mb && (
                <>
                  <dt>File size</dt>
                  <dd>{b.video.size_mb} MB</dd>
                </>
              )}
              <dt>Visuals</dt>
              <dd>{b.video.source}</dd>
              <dt>Narration</dt>
              <dd>{b.meta.tts_engine || '—'}</dd>
              {b.meta.voice && (
                <>
                  <dt>Voice</dt>
                  <dd>{b.meta.voice}</dd>
                </>
              )}
              <dt>Text model</dt>
              <dd>{b.meta.text_model}</dd>
              <dt>Upload</dt>
              <dd>
                {b.upload.uploaded ? (b.upload.privacy || 'uploaded') : 'pending'}
              </dd>
            </dl>
            {b.upload.uploaded && b.upload.url && (
              <a className="btn" href={b.upload.url} target="_blank" rel="noreferrer">
                ▶ View on YouTube
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
