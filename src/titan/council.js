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
    const librarian = await this.agents[AGENTS.LIBRARIAN].think(task, `${context}\n\nARCHITECT:\n${architect}`);
    const builder = await this.agents[AGENTS.BUILDER].think(task, `${context}\n\nARCHITECT:\n${architect}\n\nLIBRARIAN:\n${librarian}`);
    const review = await this.agents[AGENTS.REVIEWER].think(task, `${context}\n\nARCHITECT:\n${architect}\n\nLIBRARIAN:\n${librarian}\n\nBUILDER PROPOSAL:\n${builder}`);
    const testPlan = await this.agents[AGENTS.TESTER].think(task, `${context}\n\nARCHITECT:\n${architect}\n\nBUILDER:\n${builder}\n\nREVIEWER:\n${review}`);

    return { architect, librarian, builder, review, testPlan };
  }
}

module.exports = TitanCouncil;
