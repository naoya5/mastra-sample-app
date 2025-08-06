import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { weatherWorkflow } from "./workflows/weather-workflow";
import { financialAnalysisWorkflow } from "./workflows/financial-analysis-workflow";
import { taskManagementWorkflow } from "./workflows/task-management-workflow";
import { weatherAgent } from "./agents/weather-agent";
import { financialAgent } from "./agents/financial-agent";

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    financialAnalysisWorkflow,
    taskManagementWorkflow,
  },
  agents: { weatherAgent, financialAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
