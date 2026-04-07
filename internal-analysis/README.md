# Internal Analysis

This folder is for internal, ad-hoc analysis artifacts that use this repo's connectivity and environment, but are not part of the runtime dashboard application.

Current analysis packs:

- `website-health/` - case-level Website Health investigation docs, SQL templates, and generated comparison CSV outputs.

Guidelines:

- Keep production app logic in `src/`.
- Keep one-off analysis docs/outputs here.
- Never commit secrets or credentials.
