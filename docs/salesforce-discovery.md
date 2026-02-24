# Salesforce API discovery

Read-only discovery and documentation for Salesforce data and REST API. Use this doc to track what we have access to so we can design fine-tuned API calls and charts.

## References

- [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Describe Global](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_describeGlobal.htm) – list all sobjects
- [SObject Describe](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_sobject_describe.htm) – metadata for one object
- [Query (SOQL)](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm) – run SOQL

## Setup (env)

All Salesforce API calls are **server-side only** and **read-only**. Required in `.env.local`:

| Variable | Description |
|----------|-------------|
| `SF_LOGIN_URL` | OAuth token endpoint host, e.g. `https://login.salesforce.com` (prod) or `https://test.salesforce.com` (sandbox). Defaults to prod if unset. |
| `SF_CLIENT_ID` or `SALESFORCE_CONSUMER_KEY` | Connected App **Consumer Key** |
| `SF_CLIENT_SECRET` or `SALESFORCE_CONSUMER_SECRET` | Connected App **Consumer Secret** |
| `SALESFORCE_EMAIL_KYLE` | Salesforce username (email) |
| `SALESFORCE_PASSWORD_KYLE` | Salesforce password |
| `SALESFORCE_SECURITY_TOKEN_KYLE` | Security token (appended to password for API login) |

**Connected App:** Create one in Setup → App Manager → New Connected App. Enable "OAuth Settings", add callback URL (e.g. `https://localhost/callback`), select "Enable for Device Flow" or allow "Password" flow. Copy Consumer Key → `SF_CLIENT_ID`, Consumer Secret → `SF_CLIENT_SECRET`.

## Discovery endpoints in this app

- **GET `/api/salesforce/discover`** – Describe Global (list of all sobjects). Optional `?sobject=Account` returns full describe (fields, types) for that sobject.
- **GET `/api/salesforce/query?q=SOQL`** – Run a read-only SOQL query. Example: `?q=SELECT Id, Name FROM Account LIMIT 10`. Use to explore data and shape future widgets.
- Use these to explore objects, fields, and data before wiring charts.

---

## Discovery log

*Add entries below as you explore. Note object names, interesting fields, and ideas for charts/widgets.*

### Describe Global (sobjects list)

| Date | Notes |
|------|--------|
| *(run GET /api/salesforce/discover and paste or summarize sobjects you care about)* | |

**Standard objects we care about (examples):** Account, Contact, Opportunity, Lead, Case, Task, Event, Campaign, etc.

---

### SObject describes (metadata)

*After calling `/api/salesforce/discover?sobject=Account` (or other), note key fields and types.*

#### Account
| Field | Type | Notes |
|-------|------|-------|
| *(fill from describe response)* | | |

#### Opportunity
| Field | Type | Notes |
|-------|------|-------|
| *(fill from describe response)* | | |

#### *(add more objects as you discover)*

---

### SOQL / data ideas

| Idea | Object(s) | Fields / query | Use (chart, widget) |
|------|-----------|----------------|---------------------|
| *(e.g. Open opportunities by stage)* | Opportunity | StageName, Amount, CloseDate | Bar chart |
| *(add as we discover)* | | | |

---

### Gotchas and notes

- *(e.g. "Custom objects show in describeGlobal with __c suffix")*
- *(e.g. "Relationship names use __r for custom lookups")*
