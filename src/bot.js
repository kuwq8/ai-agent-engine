require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const express = require('express');
const TitanOrchestrator = require('./orchestrator');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();

// Express server for health checks (Railway requirement)
app.get('/', (req, res) => res.send('Titan AI Discord Bot & Orchestrator is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

const botToken = process.env.DISCORD_BOT_TOKEN;

if (!botToken) {
    console.warn('⚠️ [WARNING] DISCORD_BOT_TOKEN is missing or empty. The Discord Bot will not start, but the Express server is running for Health Checks.');
} else {
    const client = new Client({ 
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ] 
    });

    const orchestrator = new TitanOrchestrator();

    client.once('ready', () => {
        console.log(`Logged in as ${client.user.tag}! Ready to orchestrate tasks.`);
    });

    client.on('messageCreate', async (message) => {
        // Ignore bot messages
        if (message.author.bot) return;

        // Check for images
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                const replyMsg = await message.reply('Image received! Analyzing vision and layout...');
                try {
                    const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                    const tempPath = path.join(__dirname, '..', `temp_image_${Date.now()}.jpg`);
                    fs.writeFileSync(tempPath, Buffer.from(response.data));
                    
                    const layoutExtracted = await orchestrator.extractLayoutFromImage(tempPath);
                    fs.unlinkSync(tempPath);
                    
                    await replyMsg.edit(`Layout extraction completed:\n${layoutExtracted.substring(0, 1800)}\n\nProceeding to generate code...`);
                    return;
                } catch (err) {
                    return replyMsg.edit(`Error processing image: ${err.message}`);
                }
            }
        }

        const text = message.content.trim();
        if (!text || text.length < 3) return;
        
        // Safety check
        if (!orchestrator.validateCommand(text)) {
            return message.reply('⚠️ Dangerous command detected! Please confirm by typing "CONFIRM_EXECUTE: [command]"');
        }
        
        try {
            if (text.startsWith('test url:')) {
                const url = text.split('test url:')[1].trim();
                const replyMsg = await message.reply(`Running browser tests on ${url}...`);
                const result = await orchestrator.runBrowserTests(url);
                
                if (result.errors.length > 0) {
                    await replyMsg.edit(`Tests completed with errors:\n${result.errors.join('\n').substring(0, 1800)}`);
                } else {
                    await replyMsg.edit('Tests completed successfully.');
                }
                
                const file = new AttachmentBuilder(result.screenshotPath);
                await message.reply({ files: [file] });
                fs.unlinkSync(result.screenshotPath);
            } else if (text.startsWith('prompt: ') || text.toLowerCase().includes('generate')) {
                const replyMsg = await message.reply('Processing your request with Multi-Agent loop...');
                const result = await orchestrator.generateAndReviewCode(text);
                
                const codeResponse = `Claude Code Generation:\n\`\`\`javascript\n${result.code.substring(0, 1800)}\n\`\`\``;
                await message.reply(codeResponse);
                
                const reviewResponse = `Gemini Review:\n${result.review.substring(0, 1800)}`;
                await message.reply(reviewResponse);
            }
        } catch (error) {
            message.reply(`Error during processing: ${error.message}`);
        }
    });

    client.login(botToken).catch(err => {
        console.error('Failed to login to Discord:', err);
    });

    process.once('SIGINT', () => {
        client.destroy();
        orchestrator.cleanup();
    });
    process.once('SIGTERM', () => {
        client.destroy();
        orchestrator.cleanup();
    });
}
