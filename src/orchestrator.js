require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const TitanEngine = require('./titan');

// Legacy compatibility wrapper. Titan is now local-first through Ollama.
// No Gemini/Groq fallback is used here, so missing cloud API keys cannot break Titan.
class TitanOrchestrator {
  constructor() {
    this.engine = new TitanEngine();
    this.browser = null;
  }

  async chat(prompt) {
    const result = await this.engine.analyze(prompt);
    return [
      '🧠 Titan Council',
      `Architect:\n${result.architect}`,
      `Librarian:\n${result.librarian}`,
      `Builder:\n${JSON.stringify(result.builderProposal ?? result.builder)}`,
      `Reviewer:\n${JSON.stringify(result.review)}`,
      `Tester:\n${JSON.stringify(result.testPlan)}`
    ].join('\n\n');
  }

  // Kept for callers using the old method name; it no longer calls Gemini.
  async chatWithGemini(prompt) { return this.chat(prompt); }

  async generateAndReviewCode(requirements) {
    const result = await this.engine.analyze(requirements);
    return { code: result.builderProposal ?? result.builder, review: result.review };
  }

  async inspectProject() { return this.engine.inspect(); }
  async searchProject(term, limit = 40) { return this.engine.search(term, limit); }
  async runCodingTask(task) { return this.engine.run(task); }

  async extractLayoutFromImage() {
    throw new Error('Local Qwen3-Coder path is text-only. Configure an optional vision model/provider for image analysis.');
  }

  async runBrowserTests(url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('Only http/https URLs are allowed.');
    if (!this.browser) this.browser = await chromium.launch();
    const page = await this.browser.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const screenshotPath = path.join(__dirname, '..', `screenshot-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return { screenshotPath, errors };
    } finally {
      await page.close();
    }
  }

  validateCommand(command) {
    if (!command) return true;
    return !/(rm\s+-rf|mkfs|dd\s+if=|shutdown|reboot|drop\s+database|truncate\s+table)/i.test(command);
  }

  async cleanup() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = TitanOrchestrator;
