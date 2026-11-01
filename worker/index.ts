import app from "./api/app";
import { isConfigured } from "./config";
import { runScheduler } from "./schedule/scheduler";

export { EditionWorkflow } from "./workflow/edition-workflow";

export default {
  fetch: app.fetch,
  scheduled(controller, env, ctx) {
    if (!isConfigured(env.DATABASE_URL)) return;
    ctx.waitUntil(
      runScheduler(env, new Date(controller.scheduledTime)).catch((error: unknown) => {
        console.error("[scheduler] erreur :", error instanceof Error ? error.message : "inconnue");
      }),
    );
  },
} satisfies ExportedHandler<Env>;
