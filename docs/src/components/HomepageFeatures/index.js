import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Privacy First',
    emoji: '🔒',
    description: (
      <>
        100% local. No cloud sync, no account required, no telemetry.
        Your API keys, credentials, and request data{' '}
        <strong>never leave your machine</strong>.
      </>
    ),
  },
  {
    title: 'All HTTP Methods',
    emoji: '📡',
    description: (
      <>
        Full support for GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS.
        Build requests with query params, headers, and all body types including JSON,
        form-data, and binary.
      </>
    ),
  },
  {
    title: 'Authentication Built-in',
    emoji: '🔐',
    description: (
      <>
        Bearer Token, Basic Auth, and API Key auth out of the box. Set auth at collection
        level and let requests <em>inherit</em> it automatically.
      </>
    ),
  },
  {
    title: 'Environment Variables',
    emoji: '🌍',
    description: (
      <>
        Manage multiple environments (Dev, Staging, Prod) with variable substitution using{' '}
        <code>{'<<variable_name>>'}</code> syntax. Secret variables are stored separately.
      </>
    ),
  },
  {
    title: 'Pre/Post Scripts',
    emoji: '📜',
    description: (
      <>
        Run JavaScript before and after requests. Set variables dynamically, write assertions,
        and use built-in snippets for common patterns.
      </>
    ),
  },
  {
    title: 'Code Generation',
    emoji: '💻',
    description: (
      <>
        Generate ready-to-use code snippets for cURL, JavaScript, Python, Java, C#, Go, Rust,
        and C++ — with variables fully resolved.
      </>
    ),
  },
  {
    title: 'Collection Runner',
    emoji: '🏃',
    description: (
      <>
        Run entire collections sequentially or in parallel, with configurable delay, multiple
        iterations, and stop-on-error support.
      </>
    ),
  },
  {
    title: 'Import & Export',
    emoji: '🔄',
    description: (
      <>
        Import from Postman (v2.1), OpenAPI/Swagger, and cURL commands. Export to Postman format
        or back up entire workspaces to a single JSON file.
      </>
    ),
  },
  {
    title: '9 Built-in Themes',
    emoji: '🎨',
    description: (
      <>
        Choose from Dark, Light, Ocean, Forest, Earth, Aurora, Flame, Candy, and Rainbow themes —
        or build your own fully custom theme.
      </>
    ),
  },
];

function Feature({title, emoji, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className={clsx('feature-card', styles.featureCard)}>
        <div className={styles.featureEmoji} role="img" aria-label={title}>
          {emoji}
        </div>
        <div className="padding-horiz--md">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row" style={{gap: '1.5rem 0'}}>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
