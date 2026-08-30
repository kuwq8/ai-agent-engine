require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const TitanOrchestrator = require('./orchestrator');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Default fallback token or throw error if not provided in production
const botToken = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new Telegraf(botToken);
const orchestrator = new TitanOrchestrator();
const app = express();

// Express server for health checks (Railway requirement)
app.get('/', (req, res) => res.send('Titan AI Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// Telegram Bot Handlers
bot.start((ctx) => ctx.reply('Welcome to Titan AI Multi-Agent Orchestrator! Send me requirements, code, or images.'));

bot.on('photo', async (ctx) => {
    ctx.reply('Image received! Analyzing vision and layout...');
    
    try {
        const fileId = ctx.message.photo.pop().file_id;
        const file = await ctx.telegram.getFileLink(fileId);
        const response = await axios.get(file.href, { responseType: 'arraybuffer' });
        
        const tempPath = path.join(__dirname, '..', `temp_image_${Date.now()}.jpg`);
        fs.writeFileSync(tempPath, Buffer.from(response.data));
        
        const layoutExtracted = await orchestrator.extractLayoutFromImage(tempPath);
        fs.unlinkSync(tempPath); // cleanup
        
        ctx.reply(`Layout extraction completed:\n${layoutExtracted}\n\nProceeding to generate code...`);
    } catch (err) {
        ctx.reply(`Error processing image: ${err.message}`);
    }
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // Safety check
    if (!orchestrator.validateCommand(text)) {
        return ctx.reply('⚠️ Dangerous command detected! Please confirm by typing "CONFIRM_EXECUTE: [command]"');
    }
    
    ctx.reply('Processing your request with Multi-Agent loop...');
    
    try {
        if (text.startsWith('test url:')) {
            const url = text.split('test url:')[1].trim();
            ctx.reply(`Running browser tests on ${url}...`);
            const result = await orchestrator.runBrowserTests(url);
            
            if (result.errors.length > 0) {
                ctx.reply(`Tests completed with errors:\n${result.errors.join('\n')}`);
            } else {
                ctx.reply('Tests completed successfully.');
            }
            
            await ctx.replyWithPhoto({ source: result.screenshotPath });
            fs.unlinkSync(result.screenshotPath); // Cleanup screenshot
        } else {
            const result = await orchestrator.generateAndReviewCode(text);
            ctx.reply(`Claude Code Generation:\n\`\`\`\n${result.code}\n\`\`\``, { parse_mode: 'Markdown' });
            ctx.reply(`Gemini Review:\n${result.review}`);
        }
    } catch (error) {
        ctx.reply(`Error during processing: ${error.message}`);
    }
});

bot.launch().then(() => {
    console.log('Bot successfully launched!');
});

// Enable graceful stop
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    orchestrator.cleanup();
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    orchestrator.cleanup();
});
