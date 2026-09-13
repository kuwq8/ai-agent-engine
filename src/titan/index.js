const LocalModel = require('./model');
const TitanCouncil = require('./council');

class TitanEngine {
  constructor(options = {}) {
    this.model = options.model || new LocalModel();
    this.council = new TitanCouncil(this.model);
  }

  async health() {
    return this.model.health();
  }

  async analyze(task, context = '') {
    return this.council.discuss(task, context);
  }
}

module.exports = TitanEngine;
