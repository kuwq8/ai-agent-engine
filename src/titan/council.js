const { TitanAgent } = require('./agent');
const { AGENTS } = require('./types');

class TitanCouncil {
  constructor(model) {
    this.model = model;
    this.agents = Object.fromEntries(
      Object.values(AGENTS).map(role => [role, new TitanAgent(role, model)])
    );
  }

  async discuss(task, context = '') {
    const architect = await this.agents[AGENTS.ARCHITECT].think(task, context);
    const librarian = await this.agents[AGENTS.LIBRARIAN].think(task, `${context}\n\nArchitect:\n${architect}`);
    const builder = await this.agents[AGENTS.BUILDER].think(task, `${context}\n\nArchitect:\n${architect}\n\nKnowledge:\n${librarian}`);
    const review = await this.agents[AGENTS.REVIEWER].think(task, `${context}\n\nPlan:\n${architect}\n\nKnowledge:\n${librarian}\n\nProposed implementation:\n${builder}`);
    const testPlan = await this.agents[AGENTS.TESTER].think(task, `${context}\n\nPlan:\n${architect}\n\nImplementation:\n${builder}\n\nReview:\n${review}`);

    return { architect, librarian, builder, review, testPlan };
  }
}

module.exports = TitanCouncil;
