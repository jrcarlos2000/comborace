import { defineConfig } from 'vitepress'

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2306060c'/%3E%3Crect x='7' y='13' width='18' height='7' rx='3.5' fill='%237E5DFE'/%3E%3Crect x='2' y='15' width='5' height='3' rx='1.5' fill='%237E5DFE' opacity='0.5'/%3E%3C/svg%3E"

export default defineConfig({
  title: 'ComboRace',
  description:
    'Your group-chat parlay, turned into a live car race where the cars ARE the odds. Betting you can watch, powered by demargined TxLINE win-probability.',
  lang: 'en-US',

  // Served under comborace.jrcarlos2000.dev/docs so every asset resolves beneath /docs.
  base: '/docs/',

  // The app is a light, crafted Danny surface, so the docs force light too.
  appearance: false,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', href: favicon }],
    ['meta', { name: 'theme-color', content: '#EDEEF2' }],
    ['meta', { property: 'og:title', content: 'ComboRace Docs' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Betting you can watch. The parlay-as-a-race game built on TxLINE.'
      }
    ]
  ],

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'ComboRace' },

    nav: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'How it works', link: '/guide/how-it-works' },
      { text: 'Game mechanic', link: '/guide/game-mechanic' },
      { text: 'TxLINE', link: '/guide/txline-integration' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'Roadmap', link: '/guide/roadmap' },
      { text: 'Play', link: 'https://comborace.jrcarlos2000.dev' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Overview',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'How it works', link: '/guide/how-it-works' }
          ]
        },
        {
          text: 'Under the hood',
          items: [
            { text: 'The game mechanic', link: '/guide/game-mechanic' },
            { text: 'TxLINE integration', link: '/guide/txline-integration' },
            { text: 'Architecture', link: '/guide/architecture' }
          ]
        },
        {
          text: 'Ahead',
          items: [{ text: 'Roadmap', link: '/guide/roadmap' }]
        }
      ]
    },

    socialLinks: [{ icon: 'x', link: 'https://x.com/deltahedged_eth' }],

    search: { provider: 'local' },

    footer: {
      message: 'Betting you can watch. Built on TxLINE.',
      copyright: 'ComboRace'
    }
  }
})
