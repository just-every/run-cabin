If you already use an AI agent or a script, Cabin can give it a token to prepare work for you: calendar reviews, turnover assignments and owner statements. A person always approves each exact draft; the agent can never approve, complete a job or change your team.

## Create a token

1. As the owner, open **Agent access**.
2. Under **Create an agent credential**, give it an **Agent label**, such as "Operations assistant", and choose **Create preparation token**.
3. Copy the token from the notice straight into your agent's private configuration. It is shown once and never again.

A token lasts 30 days. Cabin stores only a fingerprint of it.

## Connect your agent

The agent sends the token as a bearer header to two addresses on your installation:

```http
GET /api/cabin/agent/context
POST /api/cabin/agent/command
Authorization: Bearer TOKEN
```

It may run three commands, each of which prepares a draft:

| Command | What it prepares |
| --- | --- |
| `calendar.prepare` | A calendar review from a channel's calendar file. |
| `turnover.prepare` | A turnover with a cleaner and checklist for an approved booking. |
| `statement.prepare` | An owner statement draft for a home and month. |

The inputs for each are in the [Command reference](/docs/commands). Drafts appear in the app beside your own, for you or a manager to approve.

## Revoke a token

Under **Credentials**, choose **Revoke agent access**. The token stops working on its next request. **Approval history** lists the approvals people have made, with who approved what and when.


Company agents use the [shared agent door](/docs/company-agent-door). Its current
bounded registry and local-key scopes are documented separately from this
legacy draft-key door.
