# OpenAI Provider Archive

This project previously contained a second AI provider path using the OpenAI Responses API alongside OpenRouter.

It was removed from the active codebase because:

- the current project only uses OpenRouter in local runs and GitHub Actions
- the unused OpenAI path increased config surface area and failure modes
- stale OpenAI secrets and env validation caused avoidable deployment issues

What was removed from the active implementation:

- OpenAI-specific analyzer logic from `src/ai/provider.ts`
- OpenAI env vars and provider switching from `src/config/env.ts`
- OpenAI-related workflow secrets from `.github/workflows/nightly.yml`
- OpenAI-specific setup references from `.env.example`, tests, and `README.md`

If OpenAI support is needed again later, reintroduce it as a separate, intentional feature instead of keeping an inactive branch in the runtime code.
