require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder } = require('discord.js');
const express = require('express');
const TitanOrchestrator = require('./orchestrator');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { initDatabase } = require('./memory');

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
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ],
        partials: [
            Partials.Channel,
            Partials.Message
        ]
    });

    const orchestrator = new TitanOrchestrator();

    client.once('ready', () => {
        console.log(`Logged in as ${client.user.tag}! Ready to orchestrate tasks.`);
    });

    // Helper function to split long messages
    const splitMessage = (text, maxLength = 2000) => {
        if (!text) return [];
        const parts = [];
        let currentPart = '';
        const lines = text.split('\n');
        for (const line of lines) {
            if (currentPart.length + line.length + 1 > maxLength) {
                if (currentPart) parts.push(currentPart);
                currentPart = line + '\n';
            } else {
                currentPart += line + '\n';
            }
        }
        if (currentPart) parts.push(currentPart.trim());
        return parts;
    };

    client.on('messageCreate', async (message) => {
        // Ignore bot messages
        if (message.author.bot) return;

        // Check if the bot is mentioned or if it's a DM
        const isMentioned = message.mentions.has(client.user.id) || message.mentions.users.has(client.user.id);
        const isDM = message.channel.isDMBased();

        if (!isMentioned && !isDM) return;

        // Strip the bot mention from the prompt cleanly
        const prompt = message.content.replace(/<@!?[0-9]+>/g, '').trim();
        console.log("Received prompt:", prompt);

        // Send typing indicator
        await message.channel.sendTyping();

        if (!prompt && message.attachments.size === 0) {
            return message.reply("Hello! How can I help you today? Send me a message, an image, or a URL to test.");
        }

        // Safety check
        if (prompt && !orchestrator.validateCommand(prompt)) {
            return message.reply('⚠️ Dangerous command detected! Please confirm by typing "CONFIRM_EXECUTE: [command]"');
        }

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
                    
                    const responseText = `Layout extraction completed:\n${layoutExtracted}\n\nProceeding to generate code...`;
                    const parts = splitMessage(responseText);
                    await replyMsg.edit(parts[0]);
                    for (let i = 1; i < parts.length; i++) {
                        await message.reply(parts[i]);
                    }
                    return;
                } catch (err) {
                    console.error('Error processing image:', err);
                    return replyMsg.edit(`Error processing image: ${err.message}`);
                }
            }
        }

        try {
            if (prompt.startsWith('test url:')) {
                const url = prompt.split('test url:')[1].trim();
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
            } else if (prompt.startsWith('generate:')) {
                const req = prompt.split('generate:')[1].trim();
                const replyMsg = await message.reply('Processing your request with Multi-Agent loop...');
                const result = await orchestrator.generateAndReviewCode(req);
                
                const codeResponse = `Claude Code Generation:\n\`\`\`javascript\n${result.code}\n\`\`\``;
                const reviewResponse = `Gemini Review:\n${result.review}`;
                
                const allParts = [...splitMessage(codeResponse), ...splitMessage(reviewResponse)];
                for (let i = 0; i < allParts.length; i++) {
                    if (i === 0) await replyMsg.edit(allParts[i]);
                    else await message.reply(allParts[i]);
                }
            } else {
                // Query Gemini Model directly for normal chat
                const responseText = await orchestrator.chatWithGemini(prompt);
                const parts = splitMessage(responseText);
                
                for (const part of parts) {
                    await message.reply(part);
                }
            }
        } catch (error) {
            console.error('Error during processing:', error);
            message.reply(`An error occurred while processing your request: ${error.message}`);
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
