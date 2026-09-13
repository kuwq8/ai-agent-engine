class TitanLoop {
  constructor(engine) {
    this.engine = engine;
    this.maxIterations = Number(process.env.TITAN_MAX_ITERATIONS || 3);
  }

  async run(task, onProgress = () => {}) {
    const history = [];
    let currentTask = task;

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      await onProgress(`🧠 Titan ${iteration}/${this.maxIterations}: يفهم المشروع ويحلل السبب...`);
      const discussion = await this.engine.analyze(currentTask);
      const patch = discussion.builderProposal;
      if (!patch || !Array.isArray(patch.edits)) {
        history.push({ iteration, applied: false, reason: 'invalid_builder_patch' });
        currentTask = `${task}\nBuilder لم يرجع Patch صالح. أعد الخطة وأرجع JSON مطابق للمخطط.`;
        continue;
      }

      await onProgress('🔍 Reviewer يراجع التعديل قبل لمس الملفات...');
      const review = String(discussion.review || '');
      if (/(reject|critical|unsafe|do not implement|incorrect|major bug)/i.test(review)) {
        history.push({ iteration, applied: false, reason: 'review_rejected', review, patch });
        currentTask = `${task}\n\nReviewer rejected the patch:\n${review}\n\nProduce a corrected safe patch.`;
        continue;
      }

      const commands = Array.isArray(discussion.testPlan?.commands) ? discussion.testPlan.commands : (Array.isArray(patch.commands) ? patch.commands : []);
      const checkpoint = await this.engine.git.checkpoint(`Titan iteration ${iteration}`);
      let applied = null;
      try {
        await onProgress(`🛠️ تطبيق ${patch.edits.length} تعديل...`);
        applied = await this.engine.patcher.apply(patch.edits);
        await onProgress('🧪 تشغيل التحقق...');
        const results = [];
        for (const command of commands.slice(0, 5)) results.push(await this.engine.executor.run(command));
        const failed = results.some(r => r.code !== 0);
        history.push({ iteration, checkpoint, patch, commands, results, applied: true });

        if (failed) {
          await onProgress('❌ الاختبار فشل. أرجع التعديل وأبحث عن السبب الجذري...');
          await this.engine.patcher.restore(applied.backups);
          currentTask = `${task}\n\nVerification failed. Diagnose from exact results:\n${JSON.stringify(results).slice(0, 30000)}`;
          continue;
        }

        const diff = await this.engine.git.diff().catch(() => ({ stdout: '' }));
        await this.engine.memory.add('lessons', { task, iteration, summary: patch.summary || '', files: patch.edits.map(e => e.path), commands, result: 'verified' });
        await this.engine.memory.add('decisions', { task, summary: patch.summary || '', files: patch.edits.map(e => e.path) });
        await onProgress('✅ التعديل نجح والتحقق اكتمل.');
        return { success: true, history, summary: patch.summary || 'Titan completed and verified the change.', diff: diff.stdout || '' };
      } catch (error) {
        if (applied?.backups) await this.engine.patcher.restore(applied.backups).catch(() => {});
        history.push({ iteration, checkpoint, applied: false, error: error.message });
        currentTask = `${task}\n\nImplementation failed: ${error.message}\nPropose a corrected safe approach.`;
      }
    }

    return { success: false, history, summary: 'Titan exhausted its verification iterations without proving the requested result.' };
  }
}

module.exports = TitanLoop;
