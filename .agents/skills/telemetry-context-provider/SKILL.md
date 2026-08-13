---
name: telemetry-context-provider
description: >-
  Provides wearable telemetry context (telemetry_logs) to enrich nurse voice
  transcripts for Peace Letter generation — never clinical interpretation.
  Polar AccessLink is the ingest path (ADR-007); BLE gateways retired.
  Use when combining telemetry with voice notes, Polar sync, HR/steps
  context, or non-MD Guardrails for activity/mood wording.
---

# Telemetry Context Provider (Pakiet Spokoju)

**Plik kanoniczny skilla:** ten `SKILL.md`.  
**Bramka Guardrails:** [`.cursor/rules/ai-prompt-guardrails.mdc`](../../../.cursor/rules/ai-prompt-guardrails.mdc).  
**Schema:** `polar_*` (kanon, ADR-009) + `telemetry_logs` (legacy).  
**Wycofane:** `iot_gateways`, Edge `ingest-telemetry`.

## Rola agenta

1. Pobierz **ostatnie rekordy** Polar (`polar_daily_activity`, sen, opcjonalnie HR/HRV) dla `patient_id` wyłącznie po stronie **Edge** (`service_role`). Fallback: `telemetry_logs`.
2. Połącz je z **transkrypcją głosową** pielęgniarki jako kontekst pomocniczy (enrichment).
3. Wygeneruj / wzbogac Peace Letter zgodnie z twardymi Guardrails poniżej.
4. Telemetria **nie zastępuje** raportu głosowego — tylko go uzupełnia.
**Client SELECT Polar:** family + zgoda; personel (`org_admin`/`nurse`) w swojej org (Big Picture). Personel nie czyta tokenów OAuth.

## TWARDE GUARDRAILS (non-MD / MDR — bezwzględne)

System **nie jest wyrobem medycznym**. Agent ma **BEZWZGLĘDNY ZAKAZ** interpretowania danych telemetrycznych jako parametrów medycznych. Sen, HRV, tętno = wyłącznie **komfort i samopoczucie**.

**Zakazane słowa / pojęcia (lista niewyczerpująca):**
- arytmia, tachykardia, bradykardia
- niepokojący puls, nieprawidłowe tętno, alarm HR
- niedotlenienie, zawał, omdlenie (jako wniosek z opaski)
- diagnoza, rozpoznanie, wskazanie kliniczne, zlecenie lekarskie
- jakiekolwiek wnioskowanie medyczne z `hr_avg` / `hr_min` / `hr_max` / HRV

**Zakaz w wyjściu dla rodziny:**
- surowe wartości HR (np. „puls 112”)
- cytowanie `raw_data` lub surowych próbek
- treść kliniczna przemycana z notatki personelu

Przy podejrzeniu treści klinicznej w transkrypcji → `urgency` / `pending_clinical_review` (istniejący pipeline Guardrails) — **nie** „lecz” telemetrią.

## Dozwolony format wyjściowy (Peace Letter)

Dane telemetryczne mogą służyć **jedynie** do opisu **nastroju i aktywności**, np.:

- „Pan Jan miał dziś spokojny dzień i przespał bez przerw 7 godzin”
- „Był dziś bardzo aktywny, co widać po dużej liczbie kroków”
- „Opaska była założona przez większość dnia; rytm dnia wyglądał spokojnie”

Mapowanie pomocnicze (heurystyka produktowa — **nie** kliniczna):

| Sygnał (wewnętrzny) | Dozwolony język Peace Letter |
|---------------------|------------------------------|
| Wysoki `step_count_delta` | aktywny dzień, dużo ruchu |
| Niski `step_count_delta` + spokojna notatka | spokojny / wyciszony dzień |
| `device_on_body = false` / `hr_avg = 0` | nie wnioskuj stanu zdrowia; pomiń lub „brak ciągłego odczytu aktywności” |
| Skoki HR | **nie komentuj** medycznie; co najwyżej ogólna aktywność jeśli wspiera to głos |

## Kontrakt kontekstu dla LLM (Edge)

Do promptu wrzucaj **pseudonimizowany** kontekst (bez PESEL, bez pełnego nazwiska + stanu zdrowia):

```json
{
  "voice_transcript": "...",
  "telemetry_windows": [
    {
      "time_window_start": "ISO",
      "hr_avg": 72,
      "step_count_delta": 420,
      "device_on_body": true
    }
  ],
  "guardrails": "non_md_activity_mood_only"
}
```

Wynik: Structured JSON z `processed_data` (Peace Letter), `is_ai_generated: true`, bez wycieku liczb HR do rodziny.

## Checklist przed ship

- [ ] Telemetria z `polar_*` (lub legacy `telemetry_logs`) — nie raw stream
- [ ] Portal rodziny: `family_wearable_comfort` / zgoda; nie dump BPM w copy
- [ ] Personel czyta metryki Polar tylko w swojej org (Big Picture); tokeny OAuth poza PostgREST
- [ ] Peace Letter bez żargonu klinicznego i bez „diagnozy z opaski”
- [ ] Human oversight (`approved_by_user_id`) przed kanałem rodzinnym
- [ ] Testy Guardrails obejmują próbę przemycenia tachykardii / arytmii z telemetrii
- [ ] Brak ingestu przez `iot_gateways` / `ingest-telemetry`
- [ ] Tokeny Polar nie w tabelach z GRANT dla `authenticated`
