import { serve } from "@hono/node-server";
import { app, startAiDataRetention, startPersonReportSchedule } from "./app";

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 7001);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`OpenMonetis API listening on http://localhost:${info.port}`);
  },
);

startAiDataRetention();
startPersonReportSchedule();

export { app };
