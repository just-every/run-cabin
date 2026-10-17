/** Payout months have no timezone; keep their calendar month in every view. */
export function statementMonth(month: string) {
 const [year, number] = month.split('-').map(Number)
 return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, number - 1, 1)))
}

/** The word every screen uses for a statement's status. */
export const statementStatus = (status: string) => ({ draft: 'Draft', approved: 'Approved' } as Record<string, string>)[status] ?? status

export function usd(cents: number) {
 return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' }).format(cents / 100)
}
