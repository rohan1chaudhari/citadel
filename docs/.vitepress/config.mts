import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const base = process.env.DOCS_BASE || '/';

export default withMermaid(
  defineConfig({
    title: 'Citadel',
    description: 'Local-first personal app hub',
    base,
    ignoreDeadLinks: true,
    themeConfig: {
      logo: {
        light: '/images/citadel-logo.svg',
        dark: '/images/citadel-logo-dark.svg'
      },
      nav: [
        { text: 'What is Citadel?', link: '/what-is-citadel' },
        { text: 'Introduction', link: '/intro' },
        { text: 'CLI', link: '/cli' },
        { text: 'Knowledge Base', link: '/kb/' },
        { text: 'How-to', link: '/how-to/quickstart' }
      ],
      sidebar: [
        {
          text: 'Start Here',
          items: [
            { text: 'What is Citadel?', link: '/what-is-citadel' },
            { text: 'Introduction (technical)', link: '/intro' },
            { text: 'Quickstart', link: '/how-to/quickstart' },
            { text: 'App Showcase', link: '/showcase' }
          ]
        },
        {
          text: 'Guides',
          items: [
            { text: 'Build an app', link: '/how-to/build-an-app' },
            { text: 'Create and install an app', link: '/how-to/create-and-install-app' },
            { text: 'Manage app runtime', link: '/how-to/runtime-manager' },
            { text: 'Deploy', link: '/how-to/deploy' },
            { text: 'Extract apps safely', link: '/how-to/extract-apps-safely' },
            { text: 'Extraction cutover plan', link: '/how-to/app-extraction-cutover-plan' }
          ]
        },
        {
          text: 'Reference',
          items: [
            { text: 'Architecture', link: '/architecture' },
            { text: 'App spec', link: '/app-spec' },
            { text: 'App Contract v0', link: '/app-contract-v0' },
            { text: 'API Reference', link: '/api-reference' },
            { text: 'CLI', link: '/cli' },
            { text: 'Agent runner guide', link: '/agent-runner-guide' },
            { text: 'Manifest changelog', link: '/manifest-changelog' }
          ]
        },
        {
          text: 'Knowledge Base',
          items: [
            { text: 'Overview', link: '/kb/' },
            { text: 'Decisions', link: '/kb/decisions' },
            { text: 'Autopilot', link: '/kb/autopilot' },
            { text: 'Cron', link: '/kb/cron' }
          ]
        }
      ],
      socialLinks: [{ icon: 'github', link: 'https://github.com/rohan1chaudhari/citadel' }]
    }
  })
);
