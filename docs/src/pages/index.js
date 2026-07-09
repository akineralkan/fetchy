import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroLogo} role="img" aria-label="Fetchy Logo">
          <img src={require('@site/static/img/logo.jpg').default} alt="Fetchy Logo" style={{width: '120px', height: '120px', borderRadius: '24px'}} />
        </div>
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>

        <div className={styles.privacyBadges}>
          <span className="badge--privacy">🔒 100% Local</span>
          <span className="badge--privacy">✅ No Cloud Sync</span>
          <span className="badge--privacy">✅ No Account Required</span>
          <span className="badge--privacy">✅ No Telemetry</span>
        </div>

        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/introduction">
            Getting Started
          </Link>
          <Link
            className={clsx('button button--outline button--lg', styles.buttonOutline)}
            to="https://github.com/AkinerAlkan94/fetchy/releases">
            Download
          </Link>
        </div>

        <div className={styles.techBadges}>
          {['Electron', 'React', 'TypeScript', 'Tailwind CSS', 'Zustand'].map((tech) => (
            <span key={tech} className={styles.techBadge}>{tech}</span>
          ))}
        </div>
      </div>
    </header>
  );
}

function PrivacySection() {
  const items = [
    {icon: '🏠', title: '100% Self-Hosted', desc: 'All your data stays on your machine. No external servers involved.'},
    {icon: '☁️', title: 'No Cloud Sync', desc: 'Zero bytes of your data ever leave your computer.'},
    {icon: '👤', title: 'No Account Required', desc: 'Start using immediately without registration or login.'},
    {icon: '📊', title: 'No Telemetry', desc: 'Zero tracking, zero analytics, zero surveillance.'},
    {icon: '📡', title: 'Works Offline', desc: 'Full functionality without any internet connection.'},
    {icon: '📁', title: 'Local File Storage', desc: 'Collections, environments, and history stored as plain JSON files.'},
  ];
  return (
    <section className={styles.privacySection}>
      <div className="container">
        <div className="text--center margin-bottom--lg">
          <h2>🔒 Privacy First — Self-Hosted &amp; Offline</h2>
          <p className={styles.sectionSubtitle}>
            Fetchy is designed with privacy at its core. Unlike cloud-based alternatives,{' '}
            <strong>your data stays on your machine</strong>.
          </p>
        </div>
        <div className="row">
          {items.map(({icon, title, desc}) => (
            <div key={title} className="col col--4 margin-bottom--md">
              <div className={styles.privacyCard}>
                <span className={styles.privacyIcon}>{icon}</span>
                <div>
                  <strong>{title}</strong>
                  <p className={styles.privacyDesc}>{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const COMPARISON_TOOLS = [
  {key: 'fetchy', label: 'Fetchy'},
  {key: 'postman', label: 'Postman'},
  {key: 'insomnia', label: 'Insomnia'},
  {key: 'bruno', label: 'Bruno'},
  {key: 'hoppscotch', label: 'Hoppscotch'},
  {key: 'thunder', label: 'Thunder Client'},
];

const YES = {icon: '✅', variant: 'yes'};
const NO = {icon: '❌', variant: 'no'};
const PARTIAL = (label) => ({icon: '⚠️', variant: 'partial', label});

const COMPARISON_ROWS = [
  {
    feature: 'Price',
    fetchy: {icon: '✅', variant: 'yes', label: 'Free forever'},
    postman: PARTIAL('Free tier, $9–$59/user/mo for full features'),
    insomnia: PARTIAL('Free tier, $12–$45/user/mo for full features'),
    bruno: {icon: '✅', variant: 'yes', label: 'Free (core)'},
    hoppscotch: {icon: '✅', variant: 'yes', label: 'Free (OSS)'},
    thunder: PARTIAL('Free tier limited, Pro for teams'),
  },
  {
    feature: 'Account / sign-up required',
    fetchy: {...NO, label: 'Never'},
    postman: {...YES, label: 'Required'},
    insomnia: PARTIAL('Required for sync/Git'),
    bruno: {...NO, label: 'Never'},
    hoppscotch: PARTIAL('Optional, but pushed'),
    thunder: {...NO, label: 'Not required'},
  },
  {
    feature: 'Cloud sync forced',
    fetchy: {...NO, label: '100% local'},
    postman: {...YES, label: 'Cloud-first'},
    insomnia: PARTIAL('Cloud or Git, paid tiers'),
    bruno: {...NO, label: '100% local'},
    hoppscotch: PARTIAL('Cloud-first, self-host possible'),
    thunder: PARTIAL('Local + optional Git sync'),
  },
  {
    feature: 'Telemetry / tracking',
    fetchy: {...NO, label: 'Zero telemetry'},
    postman: {...YES, label: 'Yes'},
    insomnia: {...YES, label: 'Yes'},
    bruno: {...NO, label: 'None claimed'},
    hoppscotch: PARTIAL('Unclear (cloud-based)'),
    thunder: PARTIAL('Unclear'),
  },
  {
    feature: 'Fully open source',
    fetchy: {...YES, label: 'MIT license'},
    postman: {...NO, label: 'Closed source'},
    insomnia: PARTIAL('Restricted post-2024 license'),
    bruno: {...YES, label: 'Open source'},
    hoppscotch: {...YES, label: 'Open source'},
    thunder: {...NO, label: 'Closed source'},
  },
  {
    feature: 'Native desktop app (Electron)',
    fetchy: {...YES},
    postman: {...YES},
    insomnia: {...YES},
    bruno: {...YES},
    hoppscotch: PARTIAL('Web app / self-hosted'),
    thunder: PARTIAL('IDE extension only'),
  },
  {
    feature: 'AI Assistant built-in',
    fetchy: {...YES, label: 'Included, free'},
    postman: PARTIAL('Paid AI credits'),
    insomnia: PARTIAL('Limited, gated'),
    bruno: {...NO},
    hoppscotch: {...NO},
    thunder: {...NO},
  },
  {
    feature: 'Jira integration',
    fetchy: {...YES, label: 'Native'},
    postman: PARTIAL('Add-on, capped by plan'),
    insomnia: {...NO},
    bruno: {...NO},
    hoppscotch: {...NO},
    thunder: {...NO},
  },
  {
    feature: 'Pre/Post-request scripts',
    fetchy: {...YES},
    postman: {...YES},
    insomnia: {...YES},
    bruno: {...YES},
    hoppscotch: {...YES},
    thunder: PARTIAL('Scriptless (assertions only)'),
  },
  {
    feature: 'Code generation languages',
    fetchy: {...YES, label: '8 languages'},
    postman: PARTIAL('Snippets, fewer targets'),
    insomnia: PARTIAL('Snippets, fewer targets'),
    bruno: PARTIAL('Limited targets'),
    hoppscotch: PARTIAL('Limited targets'),
    thunder: PARTIAL('Limited targets'),
  },
  {
    feature: 'Import Postman / OpenAPI / cURL',
    fetchy: {...YES},
    postman: {...NO, label: 'N/A (source format)'},
    insomnia: {...YES},
    bruno: {...YES},
    hoppscotch: {...YES},
    thunder: PARTIAL('Postman only'),
  },
  {
    feature: 'Built-in themes',
    fetchy: {...YES, label: '9 themes + custom'},
    postman: PARTIAL('Light / dark only'),
    insomnia: PARTIAL('Light / dark only'),
    bruno: PARTIAL('Light / dark only'),
    hoppscotch: PARTIAL('Light / dark only'),
    thunder: PARTIAL('Follows editor theme'),
  },
  {
    feature: 'Unlimited Collection Runner',
    fetchy: {...YES, label: 'Free, unlimited'},
    postman: PARTIAL('Data-driven runs need paid plan'),
    insomnia: {...YES},
    bruno: {...YES},
    hoppscotch: {...YES},
    thunder: PARTIAL('Capped on free tier'),
  },
];

function ComparisonCell({data, className}) {
  if (!data) return <td className={className}>—</td>;
  const variantClass =
    data.variant === 'yes' ? styles.cellYes : data.variant === 'no' ? styles.cellNo : styles.cellPartial;
  return (
    <td className={className}>
      <span className={variantClass}>{data.icon}</span>
      {data.label && <div>{data.label}</div>}
    </td>
  );
}

function ComparisonSection() {
  return (
    <section className={styles.comparisonSection}>
      <div className="container">
        <div className="text--center margin-bottom--lg">
          <h2>⚔️ How Fetchy Compares</h2>
          <p className={styles.sectionSubtitle}>
            We researched the leading REST API clients so you don&apos;t have to. Here&apos;s how{' '}
            <strong>Fetchy</strong> stacks up on the things that actually matter.
          </p>
        </div>
        <div className={styles.comparisonScroll}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th></th>
                {COMPARISON_TOOLS.map(({key, label}) => (
                  <th key={key} className={key === 'fetchy' ? styles.fetchyColumn : undefined}>
                    {label}
                    {key === 'fetchy' && <div className={styles.winnerBadge}>★ WINNER</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  {COMPARISON_TOOLS.map(({key}) => (
                    <ComparisonCell
                      key={key}
                      data={row[key]}
                      className={key === 'fetchy' ? styles.fetchyColumn : undefined}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.comparisonNote}>
          Comparison based on each vendor&apos;s publicly available pricing and documentation as of July 2026.
          Plans and features change often — always verify current details on the vendor&apos;s own website.
        </p>
      </div>
    </section>
  );
}

function QuickStartSection() {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <h2 className="text--center">⚡ Quick Start</h2>
        <div className="row margin-top--lg">
          <div className="col col--6">
            <h3>Install from Source</h3>
            <pre className={styles.codeBlock}>{`git clone https://github.com/AkinerAlkan94/fetchy.git
cd fetchy
npm install
npm run electron:dev`}</pre>
          </div>
          <div className="col col--6">
            <h3>Or Download the Installer</h3>
            <p>Grab the latest release for Windows, macOS, or Linux — no build required.</p>
            <Link
              className="button button--primary button--lg"
              to="https://github.com/AkinerAlkan94/fetchy/releases">
              📦 Download Latest Release
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} — Local REST API Client`}
      description="Fetchy is a privacy-focused, self-hosted REST API client. Local by design, reliable by nature. No cloud, no account, no telemetry.">
      <HomepageHeader />
      <main>
        <PrivacySection />
        <HomepageFeatures />
        <ComparisonSection />
        <QuickStartSection />
      </main>
    </Layout>
  );
}
