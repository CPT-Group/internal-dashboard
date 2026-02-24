# Salesforce OAuth – CPT TV (GET only)

This app is **CPT TV** (analytics / dashboards). Salesforce integration here is **read-only**: OAuth so we can call Salesforce APIs for discovery and future charts. **No POST or create** in this codebase.

- **GET /oauth/start** – Redirects to Salesforce authorize (PKCE).
- **GET /oauth/callback** – Exchanges code for tokens, writes `.sf_tokens.json`, shows "Connected".
- **GET /api/sf/whoami** – Userinfo (verify token).
- **GET /api/sf/describe/support-channel** – Describe Support_Channel__c (for discovery; charts may use other sobjects).
- **GET /api/sf/projects** – Returns **Project__c** records as the case list (same shape as support portal: `id`, `label`, `name`, `projectName`, `caseID`). Source of truth for cases; cached 5 min. Not yet consumed by any dashboard UI; available for future use.
- **GET /api/sf/support-channel** – Returns **Support_Channel__c** records (support requests created by the support portal). Fields: `Id`, `Name`, `CreatedDate`, `Type__c`, `Case_No__c`, `Case_Email__c`, `Stage__c`, `Project__c`, `Website_Detail_Summary__c`. Ordered by `CreatedDate DESC`, limit 200. Cached 5 min. For future charts/tables; no UI yet.

**Support Portal** (submit flow, creating Support_Channel__c records) lives in the **cpt-support-portal** repo. That app has its own OAuth and **POST /api/support-request** and wires the form to Salesforce there.

## Env (server-side .env.local)

| Variable | Purpose |
|----------|---------|
| `SF_LOGIN_URL` | Default `https://login.salesforce.com` |
| `SF_API_VERSION` | Default `v60.0` |
| `SALESFORCE_CONSUMER_KEY` or `SF_CLIENT_ID` | Connected App Consumer Key |
| `SALESFORCE_CONSUMER_SECRET` or `SF_CLIENT_SECRET` | Connected App Consumer Secret |

## Curl (TV – GET only)

```bash
# 1) OAuth in browser
open "http://localhost:3333/oauth/start"

# 2) Verify token
curl -s http://localhost:3333/api/sf/whoami | jq .

# 3) Describe Support_Channel__c (or use /api/salesforce/discover?sobject=... for other objects)
curl -s http://localhost:3333/api/sf/describe/support-channel | jq .

# 4) Case list (Project__c – same source of truth as support portal)
curl -s http://localhost:3333/api/sf/projects | jq .

# 5) Support requests (Support_Channel__c – for charts/tables later)
curl -s http://localhost:3333/api/sf/support-channel | jq .
```
