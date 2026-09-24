/**
 * chat.js — chat orchestration
 * Handles Groq API calls with auto-fallback to mock on failure.
 */

(function () {
  "use strict";

  const { API_ENDPOINT, MODEL, FALLBACK_MODEL, USE_MOCK_MODE } = window.PORTFOLIO_CONFIG;
  let chatInput;
  let activeLogId = "chat-log";

  const KNOWLEDGE_BASE = {
    "hello|hi|hey|greetings": "hey! i'm raka's ai resume agent. ask me about his background, skills, experience, or anything else from his resume.",
    "what|who|about": "i'm an ai trained on raka's resume. you can ask me about his education, work experience, technical skills, certifications, or projects.",
    "skill|languages|stack|tech": "raka works with python, javascript, c, and sql. he's strong in data analysis (pandas, numpy, scipy), visualization (matplotlib, seaborn), and modern ai tech like prompt engineering, rag systems, and autonomous agents. he also uses cloud platforms like alibaba cloud.",
    "experience|intern|work": "raka did a data analyst internship at work unusual in jakarta from jan-apr 2026. he processed 2024-2025 operational records, performed statistical analysis with pandas/numpy/scipy, built visualizations with matplotlib and seaborn, and generated actionable business insights through eda.",
    "education|university|nycu|school": "raka's an incoming cs student at nycu (national yang ming chiao tung university) in hsinchu, taiwan, starting september 2026. he got the nycu international student scholarship type b. he also completed ontario secondary school diploma (ossd) at rosedale global high school.",
    "project|portfolio|github": "check out raka's github (github.com/valleysonata) and this portfolio site for his projects. he works on ai applications, data analysis tools, and full-stack web development.",
    "contact|email|phone|reach": "you can reach raka at banyulangitadyaraka@gmail.com or +62-877-4311-0466.",
    "certifications|cert|course": "raka has certifications in hackerrank sql basic (joins, subqueries, optimization), alibaba cloud academy (generative ai, prompt engineering, ml/dl, gpu), hp life data science & analytics, and coding bee academy python programming (grade a).",
    "location|jakarta|taiwan|ontario": "raka's from jakarta, indonesia. he studied in ontario, canada, and is now heading to taiwan for university at nycu.",
    "age|born|birthday": "raka is 18 years old.",
    "default": "hmm, i'm not sure about that. try asking about raka's skills, experience, education, or certifications!"
  };

  function getMockResponse(userInput) {
    const lower = userInput.toLowerCase().trim();
    for (const [keywords, response] of Object.entries(KNOWLEDGE_BASE)) {
      const keywordList = keywords.split("|");
      if (keywordList.some(kw => lower.includes(kw))) {
        return response;
      }
    }
    return KNOWLEDGE_BASE.default;
  }

  async function callGroq(messages, model) {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || `API returned ${response.status}`;
      const code = data?.error?.code || "";
      const err = new Error(msg);
      err.status = response.status;
      err.code = code;
      err.data = data;
      throw err;
    }

    if (Array.isArray(data)) {
      return data[0]?.generated_text || "";
    } else if (data.choices && data.choices[0]) {
      return data.choices[0].message?.content || data.choices[0].generated_text || "";
    } else if (data.error) {
      throw new Error(data.error.message || "Unexpected API error");
    } else {
      throw new Error("Unexpected API response format");
    }
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    chatInput.disabled = true;

    window.Messages.append("user", text);
    const contentEl = window.Messages.append("agent", "", true);

    try {
      let reply = "";

      if (USE_MOCK_MODE) {
        reply = getMockResponse(text);
      } else {
        const messages = [
          { role: "system", content: window.SYSTEM_PROMPT },
          { role: "user", content: text },
        ];

        try {
          reply = await callGroq(messages, MODEL);
        } catch (err) {
          console.warn("[raka-agent] primary model failed:", err.message, err.code);

          // If primary is decommissioned / 400 / 404, try fallback model once
          const isModelError =
            err.code === "model_decommissioned" ||
            err.code === "model_not_found" ||
            err.status === 400 ||
            err.status === 404;

          if (isModelError && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
            console.log(`[raka-agent] retrying with fallback ${FALLBACK_MODEL}`);
            try {
              reply = await callGroq(messages, FALLBACK_MODEL);
            } catch (retryErr) {
              console.warn("[raka-agent] fallback also failed:", retryErr.message);
              throw retryErr;
            }
          } else {
            throw err;
          }
        }
      }

      document.querySelector(".typing-dot")?.remove();

      reply = reply.toLowerCase().trim() || getMockResponse(text);

      window.Messages.typeOut(contentEl, reply, function () {
        contentEl.parentElement.classList.add("done");
        finalizeInput();
      });

    } catch (err) {
      document.querySelector(".typing-dot")?.remove();
      console.error("[raka-agent] all API attempts failed, using mock fallback:", err);

      // Graceful degradation: use mock instead of hard error
      const fallback = getMockResponse(text);
      const isRateLimit = err.status === 429;
      const prefix = isRateLimit
        ? "(live ai rate-limited — showing cached answer) "
        : "(live ai offline — showing cached answer) ";

      window.Messages.typeOut(contentEl, prefix + fallback, function () {
        contentEl.parentElement.classList.add("done");
        finalizeInput();
      });
    }
  }

  function finalizeInput() {
    chatInput.disabled = false;
    chatInput.focus();
    window.Cursor.update();
  }

  function init(inputId, logId) {
    var targetInputId = inputId || "chat-input";
    var targetLogId = logId || "chat-log";

    chatInput = document.getElementById(targetInputId);
    if (!chatInput) return;

    activeLogId = targetLogId;

    chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendMessage();
    });

    window.Messages.init(targetLogId);
    window.Cursor.init(targetInputId, inputId === "chat-input-mobile" ? "term-cursor-mobile" : "term-cursor");
    window.Cursor.update();
  }

  window.Chat = { init: init };
})();
