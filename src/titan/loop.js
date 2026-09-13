class TitanLoop {
  constructor(engine) {
    this.engine = engine;
    this.maxIterations = Number(process.env.TITAN_MAX_ITERATIONS || 3);
  }

  async run(task, onProgress = () => {}) {
    const history = [];
    let currentTask = task;
    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      await onProgress(`🧠 Titan ${iteration}/${this.maxIterations}: تحليل وفهم المشروع...`);
      const discussion = await this.engine.analyze(currentTask);
      const patch = discussion.builderProposal;
      if (!patch || !Array.isArray(patch.edits)) {
        history.push({ iteration, applied: false, reason: 'invalid_builder_patch' });
        currentTask = `${task}\nBuilder لم يرجع Patch صالح. أعد الخطة وأرجع JSON مطابق للمخطط.`;
        continue;
      }

      await onProgress('🔍 Reviewer يراجع التعديل قبل لمس الملفات...');
      const review = discussion.review;
      if (review && review.approved === false) {
        history.push({ iteration, applied: false, reason: 'review_rejected', review, patch });
        currentTask = `${task}\n\nمراجعة مرفوضة:\n${JSON.stringify(review)}\n\nأصلح كل المشاكل وأرجع Patch مصحح.`;
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
          await this.engine.patcher.restore(applied.backups);
          await onProgress('❌ الاختبار فشل. أرجع التعديل وأبحث عن السبب الجذري...');
          currentTask = `${task}\n\nVerification failed:\n${JSON.stringify(results).slice(0, 30000)}\n\nشخّص السبب الجذري وأرجع Patch مصحح.`;
          continue;
        }

        const diff = await this.engine.git.diff().catch(() => ({ stdout: '' }));
        const finalReview = this.engine.reviewFinal ? await this.engine.reviewFinal(task, diff.stdout || '') : { approved: true };
        if (finalReview.approved === false) {
          await this.engine.patcher.restore(applied.backups);
          history.push({ iteration, checkpoint, patch, commands, results, finalReview, applied: false, reason: 'final_review_rejected' });
          currentTask = `${task}\n\nالمراجعة النهائية رفضت التغيير:\n${JSON.stringify(finalReview)}\n\nأصلح المشكلة.`;
          continue;
        }

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
