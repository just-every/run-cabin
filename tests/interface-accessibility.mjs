import assert from 'node:assert/strict'
import AxeBuilder from '@axe-core/playwright'

/** Run beside real keyboard journeys; automated rules do not replace that use. */
export async function accessible(page) {
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()
 const failures=result.violations.map(v=>({rule:v.id,help:v.helpUrl,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))}))
 assert.deepEqual(failures,[],'the current journey has WCAG A/AA violations')
 if(result.incomplete.length)console.log('Accessibility manual checks: '+[...new Set(result.incomplete.map(r=>r.id))].join(', '))
}
