# Taylor Scout Suite Refresh — Wave 1

This release uses one shared Taylor Scout visual system across Hub, Calendar, Budget, Bible, Location List, and Scout Route.

## Included
- Shared navy/teal design tokens, typography, corner radii, buttons, search controls, and top-bar treatment.
- Context-preserving Calendar / Budget / Bible switchers remain intact.
- Budget Actuals mode with editable actual amounts and live variance by line.
- Location List quiet autosave, stable rows while typing, sortable results, and an explicit refresh notice for incoming updates.
- Scout Route Taylor Scout branding, personal and show Places Libraries, and click-to-open Route Map Peek.

## Safety
- Existing Supabase records and local backups are preserved.
- No destructive database migration is included in this wave.
- Personal and show Places Libraries in Scout Route are browser-local in this wave; cloud synchronization is the next backend step.
