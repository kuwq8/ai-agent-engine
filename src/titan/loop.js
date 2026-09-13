const { AGENTS } = require('./types');

class TitanLoop {
  constructor(engine) {
    this.engine = engine;
    this.maxIterations = Number(process.env.TITAN_MAX_ITERATIONS || 3);
  }

  async run(task) {
    const history = [];
    for (let i = 1; i <= this.maxIterations; i += 1) {
      const discussion = await this.engine.analyze(task);
      history.push({ iteration: i, discussion });
      const review = String(discussion.review || '').toLowerCase();
      const test = String(discussion.testPlan || '').toLowerCase();
      const looksAccepted = /(approved|no critical|looks good|pass|passed|accept)/.test(review) && /(pass|passed|success|no failure|verified)/.test(test);
      if (looksAccepted) break;
      task = `${task}\n\nPrevious iteration:\n${JSON.stringify(discussion)}\n\nImprove the solution; do not repeat rejected assumptions.`;
    }
    return history;
  }
}

module.exports = TitanLoop;
