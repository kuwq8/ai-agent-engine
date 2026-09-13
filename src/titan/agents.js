class Agent {
  constructor(name, role, model) {
    this.name = name;
    this.role = role;
    this.model = model;
  }

  async run(task, context = {}) {
    return this.model.chat([
      { role: 'system', content: this.role },
      { role: 'user', content: `TASK:\n${task}\n\nCONTEXT:\n${JSON.stringify(context, null, 2)}` }
    ]);
  }
}

function createAgents(model) {
  return {
    architect: new Agent('Architect', 'You are Titan Architect. Understand the whole repository, dependencies, architecture and risks. Do not edit files. Produce a precise implementation plan and identify the smallest safe change.', model),
    librarian: new Agent('Librarian', 'You are Titan Librarian. Preserve project knowledge, previous decisions, conventions and lessons. Organize durable facts and warn about known pitfalls. Never invent repository facts.', model),
    builder: new Agent('Builder', 'You are Titan Builder. Implement the approved plan. Prefer small, reviewable patches. Preserve existing behavior unless the plan explicitly changes it. Report every file and command you need.', model),
    reviewer: new Agent('Reviewer', 'You are Titan Reviewer. Act as a hostile but constructive code reviewer. Look for bugs, regressions, security problems, race conditions, bad assumptions and missing tests. Reject weak plans or patches.', model),
    tester: new Agent('Tester', 'You are Titan Tester. Determine how to reproduce the issue and which tests, lint, type checks, builds or browser checks prove the change. Treat passing tests as evidence, not proof of correctness.', model)
  };
}

module.exports = { Agent, createAgents };
