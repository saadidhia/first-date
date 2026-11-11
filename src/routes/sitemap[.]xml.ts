import { createFileRoute } from '@tanstack/react-router'

import { GUIDES } from '@/lib/guides'
import { QUESTION_TOPICS } from '@/lib/question-topics'

// /sitemap.xml: the public pages worth indexing (home, guides, questions, about, terms, privacy). Game rooms,
// AI sessions, admin and /sir are private or noindex, so they're left out.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: ({ request }) => {
        // Behind Caddy the request may arrive as plain http: the public site is always https
        const url = new URL(request.url)
        const local = /^(localhost|127\.)/.test(url.hostname)
        const origin = local ? url.origin : `https://${url.host}`
        const latest = GUIDES.map((g) => g.date)
          .sort()
          .at(-1)
        const urls = [
          { loc: '/', lastmod: latest },
          { loc: '/guides', lastmod: latest },
          ...GUIDES.map((g) => ({ loc: `/guides/${g.slug}`, lastmod: g.date })),
          { loc: '/questions' },
          ...QUESTION_TOPICS.map((t) => ({ loc: `/questions/${t.slug}` })),
          { loc: '/about' },
          { loc: '/terms' },
          { loc: '/privacy' },
        ]
        const body =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls
            .map(
              (u) =>
                `  <url><loc>${origin}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
            )
            .join('\n') +
          '\n</urlset>\n'
        return new Response(body, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
