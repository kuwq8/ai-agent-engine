require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class TitanOrchestrator {
    constructor() {
        this.browser = null;
        
        // Lazy and Safe Initialization (Graceful Fallback)
        this.genAI = process.env.GEMINI_API_KEY 
            ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) 
            : null;
            
        this.anthropic = process.env.ANTHROPIC_API_KEY 
            ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) 
            : null;
            
        this.openai = process.env.OPENAI_API_KEY 
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
            : null;
    }

    // General Chat with Gemini
    async chatWithGemini(prompt) {
        if (!this.genAI) {
            throw new Error("Gemini API is not initialized. Please provide GEMINI_API_KEY.");
        }
        
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.warn(`[Gemini Fallback] Model gemini-1.5-flash failed (${error.message}). Falling back to gemini-pro.`);
            const fallbackModel = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await fallbackModel.generateContent(prompt);
            return result.response.text();
        }
    }

    // Vision & Layout Extraction
    async extractLayoutFromImage(imagePath) {
        if (!this.genAI) {
            throw new Error("Gemini API is not initialized. Please provide GEMINI_API_KEY.");
        }
        
        console.log(`[Vision] Analyzing image at ${imagePath}`);
        const content = [
            'Analyze this UI design and provide a detailed layout structure, colors, and components to achieve 100% design match.',
            {
                inlineData: {
                    data: fs.readFileSync(imagePath).toString("base64"),
                    mimeType: 'image/jpeg'
                }
            }
        ];

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
            const result = await model.generateContent(content);
            return result.response.text();
        } catch (error) {
            console.warn(`[Gemini Fallback] Model gemini-1.5-pro failed (${error.message}). Falling back to gemini-pro-vision.`);
            const fallbackModel = this.genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
            const result = await fallbackModel.generateContent(content);
            return result.response.text();
        }
    }

    // Code Generation & Review Loop
    async generateAndReviewCode(requirements) {
        if (!this.anthropic) {
            throw new Error("Anthropic API is not initialized. Please provide ANTHROPIC_API_KEY to generate code.");
        }
        if (!this.genAI) {
            throw new Error("Gemini API is not initialized. Please provide GEMINI_API_KEY to review code.");
        }

        console.log('[Code Loop] Starting code generation with Claude...');
        let generatedCode;
        try {
            // Step 1: Claude generates code
            const claudeResponse = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4000,
                messages: [{ role: 'user', content: `Write code for the following requirements:\n${requirements}` }]
            });
            generatedCode = claudeResponse.content[0].text;
        } catch (error) {
            console.error('[Code Loop] Claude Error:', error);
            throw error;
        }
            
        console.log('[Code Loop] Reviewing code with Gemini...');
        // Step 2: Gemini reviews code
        const prompt = `Review the following code for bugs, best practices, and security issues. Suggest improvements if any.\n\nCode:\n${generatedCode}`;
        
        let reviewResult;
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
            const result = await model.generateContent(prompt);
            reviewResult = result.response.text();
        } catch (error) {
            console.warn(`[Gemini Fallback] Model gemini-1.5-pro failed (${error.message}). Falling back to gemini-pro.`);
            const fallbackModel = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await fallbackModel.generateContent(prompt);
            reviewResult = result.response.text();
        }
        
        return {
            code: generatedCode,
            review: reviewResult
        };
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
            return false;
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
