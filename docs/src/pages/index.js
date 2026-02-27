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
        <QuickStartSection />
      </main>
    </Layout>
  );
}
