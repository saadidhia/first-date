/** The public address of the site, for canonical links and structured data. */
export const SITE_URL = 'https://first-date.app'

export const SITE_NAME = 'First Date على الطريقة التونسية'

/** Who signs the articles */
export const AUTHOR = 'فريق First Date'

/** A canonical <link> for a public page path, e.g. canonical('/guides') */
export function canonical(path: string) {
  return { rel: 'canonical', href: `${SITE_URL}${path}` }
}

/** Structured data (schema.org JSON-LD), rendered as a script tag */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe here once "<" is escaped (no closing </script>)
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
