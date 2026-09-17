# Responsible AI

1. **Human in control.** AI never changes data without an explicit user confirmation. Confirmed actions are audited as AI-originated.
2. **Transparency.** AI output is labelled in the UI. Answers cite their sources (records and documents).
3. **Least privilege.** The AI sees only what the requesting user can see.
4. **Privacy.**
   - Prompts are minimised and redacted.
   - Tenants can disable AI features and prompt logging.
   - No tenant data is used to train provider models (per provider terms).
5. **Fairness.** Features that rank people (lead scoring, partner scores) are evaluated for disparate impact before release, and use no protected attributes.
6. **Reliability.** Numbers in summaries come from SQL, not from generation. Evaluation suites gate releases.
7. **Accountability.** Every AI feature has an owner, a model card and a risk rating ([ai-model-risk.md](ai-model-risk.md)).
