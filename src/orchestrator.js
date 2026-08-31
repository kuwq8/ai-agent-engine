require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const candidateModels = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-pro"
];

class TitanOrchestrator {
    constructor() {
        this.browser = null;
        
        this.geminiApiKey = process.env.GEMINI_API_KEY;
            
        this.anthropic = process.env.ANTHROPIC_API_KEY 
            ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) 
            : null;
            
        this.openai = process.env.OPENAI_API_KEY 
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
            : null;
    }

    async generateWithFallback(parts) {
        if (!this.geminiApiKey) {
            throw new Error("GEMINI_API_KEY is missing from environment variables.");
        }
        
        let lastError;
        for (const model of candidateModels) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: parts }]
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || `HTTP ${response.status}`);
                }

                if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    return data.candidates[0].content.parts[0].text;
                } else {
                    throw new Error("Invalid response format from Gemini API");
                }
            } catch (err) {
                console.warn(`[Gemini Fallback] Model ${model} failed: ${err.message}. Trying next...`);
                lastError = err;
            }
        }
        throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
    }

    // General Chat with Gemini
    async chatWithGemini(prompt) {
        try {
            return await this.generateWithFallback([{ text: prompt }]);
        } catch (error) {
            console.error('[Chat] Error:', error);
            throw error;
        }
    }

    // Vision & Layout Extraction
    async extractLayoutFromImage(imagePath) {
        console.log(`[Vision] Analyzing image at ${imagePath}`);
        const parts = [
            {
                text: 'Analyze this UI design and provide a detailed layout structure, colors, and components to achieve 100% design match.'
            },
            {
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: fs.readFileSync(imagePath).toString("base64")
                }
            }
        ];

        try {
            return await this.generateWithFallback(parts);
        } catch (error) {
            console.error('[Vision] Error:', error);
            throw error;
        }
    }

    // Code Generation & Review Loop
    async generateAndReviewCode(requirements) {
        if (!this.anthropic) {
            throw new Error("Anthropic API is not initialized. Please provide ANTHROPIC_API_KEY to generate code.");
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
            reviewResult = await this.generateWithFallback([{ text: prompt }]);
        } catch (error) {
            console.error('[Code Loop] Gemini Review Error:', error);
            throw error;
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
