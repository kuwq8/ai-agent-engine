const GitWorkspace = require('./git');

class TitanLoop {
  constructor(engine) {
    this.engine = engine;
    this.git = new GitWorkspace(engine.workspace);
    this.maxIterations = Number(process.env.TITAN_MAX_ITERATIONS || 3);
  }

  async run(task, onProgress = () => {}) {
    const history = [];
    let currentTask = task;

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      await onProgress(`🧠 Titan iteration ${iteration}/${this.maxIterations}: analysing...`);
      const discussion = await this.engine.analyze(currentTask);
      const proposal = discussion.builderProposal || discussion.builder || '';

      await onProgress('🔍 Reviewer is checking the proposed solution...');
      const review = discussion.review || '';
      const rejected = /(reject|critical|unsafe|do not implement|incorrect|major bug)/i.test(String(review));
      if (rejected) {
        history.push({ iteration, discussion, applied: false, reason: 'review_rejected' });
        currentTask = `${task}\n\nReviewer rejected the previous proposal.\n${review}\n\nProduce a safer corrected proposal.`;
        continue;
      }

      let patch = null;
      try {
        patch = typeof proposal === 'object' ? proposal : JSON.parse(String(proposal).replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
      } catch (_) {
        history.push({ iteration, discussion, applied: false, reason: 'builder_invalid_json' });
        currentTask = `${task}\n\nBuilder output was not valid JSON. Return only the required edit JSON.`;
        continue;
      }

      const edits = Array.isArray(patch.edits) ? patch.edits : [];
      if (!edits.length) {
        history.push({ iteration, discussion, applied: false, reason: 'no_edits' });
        return { success: true, history, summary: patch.summary || 'No file changes required.' };
      }

      const checkpoint = await this.git.checkpoint(`Titan iteration ${iteration}`);
      const backups = [];
      try {
        for (const edit of edits) {
          if (edit.action !== 'write') throw new Error(`Unsupported edit action: ${edit.action}`);
          const original = await this.engine.workspace.readFile(edit.path).catch(() => null);
          backups.push({ path: edit.path, original });
          await this.engine.executor.write(edit.path, edit.content);
        }

        await onProgress('🧪 Running verification commands...');
        const commands = Array.isArray(patch.commands) ? patch.commands : [];
        const results = [];
        for (const command of commands.slice(0, 5)) {
          try {
            results.push(await this.engine.executor.run(command));
          } catch (error) {
            results.push({ command, code: error.code || 1, stdout: error.stdout || '', stderr: error.stderr || error.message });
          }
        }
        const failed = results.some(r => r.code !== 0);
        history.push({ iteration, checkpoint, discussion, patch, results, applied: true });

        if (failed) {
          await onProgress('❌ Verification failed. Titan is diagnosing the failure and will retry.');
          for (const backup of backups.reverse()) {
            if (backup.original !== null) await this.engine.executor.write(backup.path, backup.original);
          }
          currentTask = `${task}\n\nVerification failed:\n${JSON.stringify(results)}\n\nFind the root cause and propose a corrected fix.`;
          continue;
        }

        await onProgress('✅ Verification passed. Final review...');
        await this.engine.memory.add('lessons', { task, iteration, summary: patch.summary || '', commands, result: 'verified' });
        return { success: true, history, summary: patch.summary || 'Titan completed and verified the change.' };
      } catch (error) {
        for (const backup of backups.reverse()) {
          if (backup.original !== null) await this.engine.executor.write(backup.path, backup.original).catch(() => {});
        }
        history.push({ iteration, checkpoint, applied: false, error: error.message });
        currentTask = `${task}\n\nImplementation failed: ${error.message}\nPropose a corrected approach.`;
      }
    }

    return { success: false, history, summary: 'Titan exhausted its verification iterations without proving the requested result.' };
  }
}

module.exports = TitanLoop;
