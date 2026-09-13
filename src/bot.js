require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const TitanEngine = require('./titan');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.json({ service: 'Titan', status: 'running' }));
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.warn('DISCORD_BOT_TOKEN is missing; HTTP health server remains available.');
} else {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel, Partials.Message]
  });
  const titan = new TitanEngine();
  const locks = new Set();
  const split = (text, max = 1900) => { const s = String(text || ''); const a=[]; for(let i=0;i<s.length;i+=max)a.push(s.slice(i,i+max)); return a.length?a:['']; };

  client.once('ready', () => console.log(`Logged in as ${client.user.tag}. Titan local engine ready.`));
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.channel.isDMBased() && !message.mentions.has(client.user.id)) return;
    const prompt = message.content.replace(/<@!?[0-9]+>/g, '').trim();
    if (!prompt) return message.reply('اكتب المهمة. مثال: `fix: اصلح مشكلة تسجيل الدخول`');
    if (locks.has(titan.workspace.root)) return message.reply('⏳ Titan مشغول بمهمة أخرى على نفس المشروع.');
    await message.channel.sendTyping();
    try {
      const lower = prompt.toLowerCase();
      if (lower === 'status' || lower === 'titan status') {
        const s = await titan.status();
        return message.reply(split(`🤖 Titan\nOllama: ${s.ollama ? '🟢' : '🔴'}\nModel: ${s.model}\nFiles: ${s.fileCount}\nWorkspace: ${s.workspace}\nGit: ${s.git.stdout || s.git.stderr}`)[0]);
      }
      if (lower.startsWith('search ')) {
        const r = await titan.search(prompt.slice(7).trim());
        return message.reply(split(`🔎 ${r.join('\n') || 'لا توجد نتائج'}`)[0]);
      }
      if (lower.startsWith('analyze:')) {
        const r = await titan.analyze(prompt.slice(8).trim());
        for (const p of split(`🧠 Architect\n${r.architect}\n\n📚 Librarian\n${r.librarian}\n\n🔍 Reviewer\n${r.review}\n\n🧪 Tester\n${r.testPlan}`)) await message.reply(p);
        return;
      }
      if (lower.startsWith('fix:') || lower.startsWith('titan fix:')) {
        const task = prompt.replace(/^titan\s+/i, '').slice(4).trim();
        locks.add(titan.workspace.root);
        const status = await message.reply('🚀 Titan: تحليل → خطة → مراجعة → تعديل → اختبار → إصلاح تلقائي...');
        const result = await titan.run(task, text => message.channel.send(text));
        await status.edit(split(`**Titan:** ${result.success ? '✅ تم والتحقق نجح' : '❌ لم يتم التحقق'}\n${result.summary}\nIterations: ${result.history?.length || 0}`)[0]);
        return;
      }
      const r = await titan.analyze(prompt);
      for (const p of split(r.architect || 'لم أستطع تحليل الطلب.')) await message.reply(p);
    } catch (error) {
      console.error(error);
      await message.reply(`❌ Titan error: ${error.message}`);
    } finally { locks.delete(titan.workspace.root); }
  });
  client.login(token).catch(err => console.error('Failed to login:', err));
}
