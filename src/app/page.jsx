const featureCards = [
  {
    title: 'Self-host first',
    body: 'Bring your own MongoDB, bucket, and AI key. The public core stays deployable without a hosted account.',
  },
  {
    title: 'One media stack',
    body: 'Asset management, design workflows, PDF tools, AI operations, and delivery APIs converge in one product surface.',
  },
  {
    title: 'Managed upgrade path',
    body: 'An optional account key unlocks support and managed entitlements without forking the public codebase.',
  },
];

const statusItems = [
  'Public split scaffold is in place.',
  'Health probes are live at /api/health/live and /api/health/ready.',
  'Deterministic transform URLs are live at /api/transforms/url.',
  'Docker and docker-compose are ready for the self-host slice.',
  'Edition and account contracts are wired for community-first boot.',
];

export default function HomePage() {
  return (
    <main id="main-content" className="shell">
      <section className="hero panel">
        <div className="eyebrow">Public Core</div>
        <h1>img-man is the open-source media operating system.</h1>
        <p className="lede">
          This shell is the first runnable cut of the public repository: a clean self-host
          base with health endpoints, Docker support, entitlement contracts, and room for the
          larger ImageMan migration.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="/api/health/live">
            Open live probe
          </a>
          <a className="button button-secondary" href="/api/health/ready">
            Open ready probe
          </a>
        </div>
      </section>

      <section className="grid three-up" aria-label="Feature summary">
        {featureCards.map((card) => (
          <article key={card.title} className="panel card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className="grid two-up">
        <article className="panel stack">
          <div className="eyebrow">Getting started</div>
          <h2>Local bootstrap</h2>
          <pre>
            <code>{`npm install\nnode scripts/self-host-bootstrap.mjs --file .env.self-host\nnpm run dev`}</code>
          </pre>
        </article>
        <article className="panel stack">
          <div className="eyebrow">Feature migration</div>
          <h2>Deterministic transform URLs</h2>
          <pre>
            <code>{`GET /api/transforms/url?assetId=asset_123&width=800&height=600&format=webp`}</code>
          </pre>
          <p>
            Same transform params produce the same cache key and the same URL, which keeps
            CDN caching stable across processes and deployments.
          </p>
        </article>
        <article className="panel stack">
          <div className="eyebrow">Current status</div>
          <h2>What this slice proves</h2>
          <ul className="status-list">
            {statusItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
