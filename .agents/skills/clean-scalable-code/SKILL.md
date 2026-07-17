---
name: clean-scalable-code
description: >-
  Clean, scalable coding standards for Pakiet Spokoju — structure, naming,
  Alpine/HTML modularity, SQL/RLS hygiene, Edge Function patterns. Use when
  writing or reviewing any application code, refactoring, adding modules,
  migrations, or Edge Functions in this repo.
---

# Clean & Scalable Code

## Always apply

Cursor rule (always on): [`.cursor/rules/clean-scalable-code.mdc`](../../../.cursor/rules/clean-scalable-code.mdc)  
Product map: [`docs/MASTER_CONTEXT.md`](../../../docs/MASTER_CONTEXT.md)

## When implementing

1. Prefer the **smallest clear design** that matches existing repo patterns.
2. Split by responsibility before the file becomes hard to navigate.
3. Reuse helpers (`_shared/`, SQL auth helpers) instead of copy-paste.
4. Keep frontend free of medical/business Guardrails.
5. After structural change: update MASTER_CONTEXT §10 if architecture/layout changed.

## Review lens

Ask: *Could a new engineer find the right place to change this in under a minute?*  
If no — restructure before shipping.
