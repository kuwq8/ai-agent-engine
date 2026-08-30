require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Initialize API Clients
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class TitanOrchestrator {
    constructor() {
        this.browser = null;
    }

    // Vision & Layout Extraction
    async extractLayoutFromImage(imagePath) {
        console.log(`[Vision] Analyzing image at ${imagePath}`);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: [
                    'Analyze this UI design and provide a detailed layout structure, colors, and components to achieve 100% design match.',
                    {
                        inlineData: {
                            data: fs.readFileSync(imagePath).toString("base64"),
                            mimeType: 'image/jpeg' // adjust based on actual image
                        }
                    }
                ]
            });
            return response.text();
        } catch (error) {
            console.error('[Vision] Error:', error);
            throw error;
        }
    }

    // Code Generation & Review Loop
    async generateAndReviewCode(requirements) {
        console.log('[Code Loop] Starting code generation with Claude...');
        try {
            // Step 1: Claude generates code
            const claudeResponse = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4000,
                messages: [{ role: 'user', content: `Write code for the following requirements:\n${requirements}` }]
            });
            const generatedCode = claudeResponse.content[0].text;
            
            console.log('[Code Loop] Reviewing code with Gemini...');
            // Step 2: Gemini reviews code
            const geminiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: `Review the following code for bugs, best practices, and security issues. Suggest improvements if any.\n\nCode:\n${generatedCode}`
            });
            
            return {
                code: generatedCode,
                review: geminiResponse.text()
            };
        } catch (error) {
            console.error('[Code Loop] Error:', error);
            throw error;
        }
    }

    // Browser Automation
    async runBrowserTests(url) {
        console.log(`[Browser] Running automated tests on ${url}`);
        if (!this.browser) {
            this.browser = await chromium.launch();
        }
        const page = await this.browser.newPage();
        const errors = [];
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
                console.log(`[Browser Console Error] ${msg.text()}`);
            }
        });

        await page.goto(url);
        
        // Auto-fix simulation (if errors occur, pass to LLM)
        if (errors.length > 0) {
            console.log('[Browser] Analyzing errors for auto-fix...');
            // Example self-healing loop hook
        }
        
        // Take screenshot
        const screenshotPath = path.join(__dirname, '..', 'screenshot.png');
        await page.screenshot({ path: screenshotPath });
        
        await page.close();
        return { screenshotPath, errors };
    }

    // Safety Guardrails
    validateCommand(command) {
        const dangerousKeywords = ['delete', 'drop', 'overwrite', 'rm -rf', 'truncate'];
        const isDangerous = dangerousKeywords.some(keyword => command.toLowerCase().includes(keyword));
        
        if (isDangerous) {
            console.warn(`[Safety] DANGEROUS COMMAND DETECTED: ${command}. Explicit user confirmation required.`);
            return false; // Return false to indicate execution is blocked
        }
        return true;
    }
    
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = TitanOrchestrator;
