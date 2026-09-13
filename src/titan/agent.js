const { AGENTS } = require('./types');

const ROLE_PROMPTS = {
  [AGENTS.ARCHITECT]: `You are Titan Architect. Understand the task and repository architecture before proposing changes. Identify affected modules, risks, dependencies, and a minimal implementation plan. Do not write code unless asked.`,
  [AGENTS.LIBRARIAN]: `You are Titan Librarian. Build and maintain project knowledge from files, configuration, Git history, previous incidents, and decisions. Prefer evidence from the repository over assumptions.`,
  [AGENTS.BUILDER]: `You are Titan Builder. Implement the approved plan. Return ONLY valid JSON with this exact shape: {"summary":"...","edits":[{"action":"write","path":"relative/path","content":"complete file content"}],"commands":["npm test"]}. No markdown, no commentary. Never invent file contents: use repository context provided. Only use action write.`,
  [AGENTS.REVIEWER]: `You are Titan Reviewer. Act as an adversarial code reviewer. Look for correctness bugs, regressions, security issues, hidden coupling, bad assumptions, and missing tests. Reject weak plans.`,
  [AGENTS.TESTER]: `You are Titan Tester. Design verification for the requested change. Identify the smallest useful test, lint, typecheck, build or browser check. Treat passing tests as evidence, not proof.`
};

class TitanAgent {
  constructor(role, model) {
    if (!ROLE_PROMPTS[role]) throw new Error(`Unknown Titan agent role: ${role}`);
    this.role = role;
    this.model = model;
  }

  async think(task, context = '') {
    const messages = [
      { role: 'system', content: ROLE_PROMPTS[this.role] },
      { role: 'user', content: `Task:\n${task}\n\nRepository context:\n${context}` }
    ];
    if (this.role === AGENTS.BUILDER) return this.model.json(messages, { temperature: 0.1 });
    return this.model.chat(messages, { temperature: this.role === AGENTS.REVIEWER ? 0.1 : 0.2 });
  }
}

module.exports = { TitanAgent, ROLE_PROMPTS };
