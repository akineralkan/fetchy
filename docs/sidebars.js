// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/first-request',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      collapsed: false,
      items: [
        'features/http-requests',
        'features/authentication',
        'features/collections',
        'features/environments',
        'features/scripts',
        'features/response-handling',
        'features/import-export',
        'features/code-generation',
        'features/workspaces',
        'features/themes',
        'features/keyboard-shortcuts',
        'features/jira-integration',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/first-request',
        'guides/environment-variables',
        'guides/collections',
        'guides/scripts',
        'guides/jira-bug-reports',
      ],
    },
  ],
};

module.exports = sidebars;
