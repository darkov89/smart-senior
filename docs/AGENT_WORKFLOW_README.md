# Agent Workflow — krótki przewodnik

Pełny decision graph i retrieval: [`AGENT_WORKFLOW.md`](AGENT_WORKFLOW.md).

## Co tu jest

Jeden agent-developer (nie zespół agentów). Przed kodem czyta **wąski** wycinek pamięci projektu, nie całe HLD. Po kodzie sprawdza, czy trzeba zapisać decyzję (Write-Back).

## Źródła prawdy (kolejność przy sprzeczności)

1. **Decyzja** — aktywny ADR + [`HLD.md`](HLD.md)
2. **Stan live** — [`MASTER_CONTEXT.md`](MASTER_CONTEXT.md)
3. **Polityka bezpieczeństwa** — [`SECURITY.md`](../SECURITY.md)
4. **Czy wymaganie jest spełnione** — [`REQUIREMENTS_TRACEABILITY.md`](REQUIREMENTS_TRACEABILITY.md) (kod ≠ weryfikacja)
5. **Quirk debug** — [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md)

## Hard stop

Niepewność RLS / RODO / AI Act / kto co widzi → agent **nie zgaduje**:

`🛑 COMPLIANCE / ARCH CHECK REQUIRED - Czekam na decyzję człowieka`

## Peace Letter (żeby nie pomylić tabel)

Rodzina czyta **`daily_reports`** (status `published`) przez widok `family_daily_reports`.  
`daily_logs.processed_data` to legacy tor personelu — nie kanał rodziny.
