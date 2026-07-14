import { defineConfig } from 'vitepress'

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231c1b19'/%3E%3Crect x='7' y='13' width='18' height='7' rx='3.5' fill='%234a6076'/%3E%3Crect x='2' y='15' width='5' height='3' rx='1.5' fill='%234a6076' opacity='0.5'/%3E%3C/svg%3E"

export default defineConfig({
  title: 'Redline',
  description:
    'Documentation for Redline, a live parlay game on TxLINE where each car is a soccer parlay and its position on the track is the live probability the parlay still cashes.',
  lang: 'en-US',

  // Served under comborace.vercel.app/docs so every asset resolves beneath /docs.
  base: '/docs/',

  // The app is a light, crafted Danny surface, so the docs force light too.
  appearance: false,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', href: favicon }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { property: 'og:title', content: 'Redline documentation' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'How Redline works: the parlay-as-a-race mechanic, the TxLINE odds feed, and on-chain settlement.'
      }
    ]
  ],

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Redline' },

    nav: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'How it works', link: '/guide/how-it-works' },
      { text: 'Game mechanic', link: '/guide/game-mechanic' },
      { text: 'TxLINE', link: '/guide/txline-integration' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'Roadmap', link: '/guide/roadmap' },
      { text: 'Play', link: 'https://comborace.vercel.app' }
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
      message: 'Built on TxLINE.',
      copyright: 'Redline'
    }
  }
})
