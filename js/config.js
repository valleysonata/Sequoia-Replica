window.PORTFOLIO_CONFIG = {
  API_ENDPOINT: "https://raka-agent-proxy.raka-portfolio.workers.dev",
  // Groq deprecated llama-3.3-70b-versatile on 2026-08-16 for Free/Developer tier.
  // Official replacements: openai/gpt-oss-120b (quality) or openai/gpt-oss-20b (speed).
  // See https://console.groq.com/docs/models
  MODEL: "openai/gpt-oss-120b",
  FALLBACK_MODEL: "llama-3.1-8b-instant",
  GROQ_API_KEY: "",
  USE_MOCK_MODE: false,
  TYPEWRITER_MS: 12,
  TYPEWRITER_CHUNK: 2,
};

// -- Resume context (read from hidden DOM node) ------------------------------
window.RESUME_CONTEXT = document
  .getElementById("raw-resume-context")
  .textContent
  .trim();

// -- System prompt (assembled once at load) ---------------------------------
window.SYSTEM_PROMPT = [
  "You are an AI assistant embedded in Adyaraka Banyu Langit's (Raka's) personal portfolio website.",
  "You help recruiters and visitors learn about Raka.\n",
  "Personal Details:",
  "- Name: Adyaraka Banyu Langit (Raka)",
  "- Gender: Male (he/him)",
  "- Age: 18 years old",
  "- Location: Jakarta, Indonesia\n",
  "Core Rules:",
  "- Raka is male. Do not use feminine pronouns under any circumstance.",
  "- Address the user chatting with you directly as 'you' or keep responses gender-neutral.",
  "- Only answer based on Raka's resume data provided below. Do not make up info.",
  "- Keep answers short: 2-3 sentences max.",
  "- Write in lowercase, casual but professional.",
  "- No bullet points or markdown formatting. Plain text only.\n",
  "Resume Context:",
  window.RESUME_CONTEXT,
].join("\n");
