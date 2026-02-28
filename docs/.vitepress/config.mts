import { defineConfig } from 'vitepress';

const base = process.env.DOCS_BASE || '/';

export default defineConfig({
  title: 'Citadel',
  description: 'Local-first personal app hub',
  base,
  themeConfig: {
    nav: [
      { text: 'Introduction', link: '/intro' },
      { text: 'CLI', link: '/cli' },
      { text: 'Knowledge Base', link: '/kb/' },
      { text: 'How-to', link: '/how-to/quickstart' }
    ],
    sidebar: [
      {
        text: 'Start Here',
        items: [
          { text: 'Introduction', link: '/intro' },
          { text: 'Quickstart', link: '/how-to/quickstart' }
        ]
      },
      {
        text: 'CLI',
        items: [{ text: 'citadel-app', link: '/cli' }]
      },
      {
        text: 'Knowledge Base',
        items: [
          { text: 'Overview', link: '/kb/' },
          { text: 'Decisions', link: '/kb/decisions' },
          { text: 'Autopilot', link: '/kb/autopilot' },
          { text: 'Cron', link: '/kb/cron' }
        ]
      },
      {
        text: 'How-to Guides',
        items: [
          { text: 'Quickstart', link: '/how-to/quickstart' },
          { text: 'Create and install an app', link: '/how-to/create-and-install-app' },
          { text: 'Manage app runtime', link: '/how-to/runtime-manager' }
        ]
      }
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/rohanchaudhari/citadel' }]
  }
});
