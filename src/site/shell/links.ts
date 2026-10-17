// Where the run site's links go. The run site never links an instance-only route (/signin, /setup, /app).
// "Try the demo" opens the hosted demo: a signed-in sample business of the visitor's own for an hour.
import run from '../run.json'

export const links = { home: '/', run: '/run', docs: '/docs', source: run.repository, demo: 'https://demo.run-cabin.com/', licence: `${run.repository}/blob/main/LICENSE` }
export const docsPath = (slug: string) => `/docs/${slug}`
