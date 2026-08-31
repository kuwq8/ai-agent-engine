require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
            throw new Error("GEMINI_API_KEY is not defined in environment variables.");
        }

        // Try v1beta endpoint first with standard models
        const endpoints = [
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${this.geminiApiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${this.geminiApiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-pro:generateContent?key=${this.geminiApiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`
        ];

        let lastError = null;

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: parts }]
                    })
                });

                const data = await response.json();

                if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return data.candidates[0].content.parts[0].text;
                }
                
                if (data.error) {
                    lastError = new Error(data.error.message);
                }
            } catch (e) {
                lastError = e;
            }
        }

        // If fixed endpoints fail, query the list of available models for this key
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.geminiApiKey}`);
            const listData = await listRes.json();
            const validModel = listData.models?.find(m => m.supportedGenerationMethods?.includes("generateContent"));

            if (validModel) {
                console.log(`[Gemini Fallback] Fixed endpoints failed. Using dynamically found model: ${validModel.name}`);
                const dynamicUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${this.geminiApiKey}`;
                const dynRes = await fetch(dynamicUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: parts }]
                    })
                });
                const dynData = await dynRes.json();
                if (dynData.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return dynData.candidates[0].content.parts[0].text;
                }
            }
        } catch (err) {
            console.error("Dynamic model fetch error:", err);
        }

        throw lastError || new Error("Failed to generate content with available Gemini models.");
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
