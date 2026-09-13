require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder } = require('discord.js');
const express = require('express');
const TitanOrchestrator = require('./orchestrator');
const fs = require('fs');
const { initDatabase } = require('./memory');

const app = express();
app.get('/', (req, res) => res.json({ service: 'Titan', status: 'running' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

const botToken = process.env.DISCORD_BOT_TOKEN;
if (!botToken) {
  console.warn('DISCORD_BOT_TOKEN is missing; Discord bot will not start.');
} else {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel, Partials.Message]
  });
  const orchestrator = new TitanOrchestrator();

  client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}. Titan local engine ready.`);
    initDatabase().catch(err => console.warn('Database unavailable; local Titan memory remains available:', err.message));
  });

  const splitMessage = (text, maxLength = 1900) => {
    if (!text) return [];
    const out = [];
    for (let i = 0; i < text.length; i += maxLength) out.push(text.slice(i, i + maxLength));
    return out;
  };

  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const mentioned = message.mentions.has(client.user.id);
    if (!mentioned && !message.channel.isDMBased()) return;
    const prompt = message.content.replace(/<@!?[0-9]+>/g, '').trim();
    if (!prompt) return message.reply('اكتب لي المهمة البرمجية اللي تبي Titan ينفذها.');
    if (!orchestrator.validateCommand(prompt)) return message.reply('⚠️ الطلب يحتوي عملية عالية الخطورة. عدّل الطلب أو استخدم تأكيدًا صريحًا بعد مراجعة العملية.');

    await message.channel.sendTyping();
    const status = await message.reply('🧠 Titan بدأ: فهم المشروع → تخطيط → مراجعة → اختبار...');
    try {
      if (prompt.toLowerCase() === 'status') {
        const info = await orchestrator.inspectProject();
        return status.edit(`🟢 Titan\nWorkspace: ${info.root}\nFiles: ${info.fileCount}`);
      }
      if (prompt.toLowerCase().startsWith('search ')) {
        const matches = await orchestrator.searchProject(prompt.slice(7).trim());
        return status.edit(`🔎 النتائج:\n${matches.join('\n').slice(0, 1800) || 'لا توجد نتائج'}`);
      }
      const result = await orchestrator.chatWithGemini(prompt);
      const parts = splitMessage(result);
      await status.edit(parts.shift() || 'تم.');
      for (const part of parts) await message.reply(part);
    } catch (error) {
      console.error(error);
      await status.edit(`❌ Titan error: ${error.message}`);
    }
  });

  client.login(botToken).catch(err => console.error('Failed to login to Discord:', err));
  const stop = async () => { client.destroy(); await orchestrator.cleanup(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
