// Base archives include operational records, immutable photo bytes, approvals,
// move-in plans and journals. Sessions, invitation links and bearer keys stay local.
export default {
 product: 'holiday/cabin',
 includeTables: ['oa_operators', 'oa_bootstrap', 'oa_invitation_cancellations', 'oa_auth_audit'],
 excludeTables: ['cb_agent_keys', 'cb_owner_links', 'cb_owner_sessions', 'cb_finance_connections'],
 replaceableTables: ['cb_meta'],
 requiredConfiguration: ['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','MAIL_PROVIDER','MAIL_FROM'],
}
