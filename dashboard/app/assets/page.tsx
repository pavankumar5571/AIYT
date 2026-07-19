import Link from 'next/link';
import assetData from '@/data/assets.json';
import type { AssetCard } from '@/lib/types';

const KIND_EMOJI: Record<string, string> = { character: '🖐️', prop: '🧩' };

export default function AssetsPage() {
  const assets = (assetData.assets || []) as AssetCard[];
  const ready = assets.filter((a) => a.asset_status === 'ready').length;
  const reuseTotal = assets.reduce((s, a) => s + Math.max(0, (a.times_seen || 0) - 1), 0);

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <div className="logo">🧩</div>
          <div>
            <h1>Asset Library</h1>
            <p>Canonical characters &amp; props — generated once, reused across every video</p>
          </div>
        </div>
      </header>

      <div className="board-toolbar">
        <nav className="tabs">
          <Link href="/" className="tab">← Board</Link>
        </nav>
      </div>

      <section className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat">
          <div className="k">Assets</div>
          <div className="v">{assets.length}</div>
        </div>
        <div className="stat">
          <div className="k">Ready</div>
          <div className="v">{ready} <small>/ {assets.length}</small></div>
        </div>
        <div className="stat free">
          <div className="k">Reuses saved</div>
          <div className="v">{reuseTotal}</div>
        </div>
      </section>

      {assets.length === 0 ? (
        <div className="col-empty" style={{ padding: '48px 0', fontSize: 14 }}>
          No assets yet. The Asset Generator (A03) will populate this once the ASMR pipeline runs —
          each character/prop is generated once and reused here.
        </div>
      ) : (
        <div className="asset-grid">
          {assets.map((a) => (
            <div className="asset" key={`${a.kind}-${a.slug}`}>
              <div className="thumb">
                {a.public_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.public_path} alt={a.name} />
                ) : (
                  <span className="ph">{KIND_EMOJI[a.kind] || '🎨'} no preview</span>
                )}
              </div>
              <div className="a-body">
                <div className="a-kind">{a.kind}</div>
                <h4>{a.name}</h4>
                <p className="a-desc">{a.visual_description}</p>
                <div className="a-foot">
                  <span className={`a-status ${a.asset_status}`}>{a.asset_status}</span>
                  <span className="a-reuse">seen ×{a.times_seen || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
