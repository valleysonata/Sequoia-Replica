// Cloudflare Worker - Groq API Proxy
// Hides API key and handles model deprecation gracefully

const DEPRECATED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.3-70b-specdec",
  "llama3-70b-8192",
  "llama-3.1-70b-versatile",
  "qwen/qwen3-32b",
  "qwen3-32b",
]);

// Groq's official replacement for llama-3.3-70b on Free tier (as of 2026-06-17 deprecation notice)
const REPLACEMENT_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "llama-3.1-8b-instant";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // Health check for GET (useful for frontend to test worker liveness)
    if (request.method === "GET") {
      return jsonResponse({
        status: "ok",
        service: "raka-agent-proxy",
        groq_configured: Boolean(env.GROQ_API_KEY),
        replacement_model: REPLACEMENT_MODEL,
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }

    if (!env.GROQ_API_KEY) {
      return jsonResponse(
        { error: { message: "GROQ_API_KEY not configured in Worker secrets. Run: wrangler secret put GROQ_API_KEY", code: "missing_api_key" } },
        500
      );
    }

    try {
      const body = await request.json();

      // Auto-rewrite deprecated model IDs so old frontends don't break
      if (body.model && DEPRECATED_MODELS.has(body.model)) {
        console.log(`Rewriting deprecated model ${body.model} -> ${REPLACEMENT_MODEL}`);
        body.model = REPLACEMENT_MODEL;
      }

      // Ensure defaults if frontend omits them
      if (!body.model) body.model = REPLACEMENT_MODEL;

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const data = await groqResponse.json();

      // If Groq says model decommissioned, retry once with fallback
      if (!groqResponse.ok && data?.error?.code === "model_decommissioned") {
        console.log(`Model ${body.model} decommissioned, retrying with ${FALLBACK_MODEL}`);
        body.model = FALLBACK_MODEL;
        const retry = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify(body),
        });
        const retryData = await retry.json();
        return new Response(JSON.stringify(retryData), {
          status: retry.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(),
          },
        });
      }

      return new Response(JSON.stringify(data), {
        status: groqResponse.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      });
    } catch (error) {
      return jsonResponse({ error: { message: error.message, code: "worker_error" } }, 500);
    }
  },
};
