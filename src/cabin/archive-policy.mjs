// Base archives include operational records, immutable photo bytes, approvals,
// move-in plans and journals. Sessions, invitation links and bearer keys stay local.
export default {
 product: 'holiday/cabin',
 includeTables: ['oa_operators', 'oa_bootstrap', 'oa_invitation_cancellations'],
 excludeTables: ['cb_agent_keys'],
 replaceableTables: ['cb_meta'],
 requiredConfiguration: ['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
}
