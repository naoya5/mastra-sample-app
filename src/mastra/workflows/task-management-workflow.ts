import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

// タスク管理用のスキーマ
const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  estimatedHours: z.number(),
  deadline: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  category: z.string().optional(),
});

const taskListSchema = z.object({
  tasks: z.array(taskSchema),
});

const prioritizedTasksSchema = z.object({
  tasks: z.array(
    taskSchema.extend({
      aiPriority: z.number(), // 1-10のスコア
      reasoning: z.string(),
    })
  ),
});

const scheduleSchema = z.object({
  dailySchedule: z.array(
    z.object({
      date: z.string(),
      tasks: z.array(
        z.object({
          taskId: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          notes: z.string().optional(),
        })
      ),
      totalHours: z.number(),
    })
  ),
  suggestions: z.string(),
  summary: z.object({
    totalTasks: z.number(),
    totalHours: z.number(),
    totalDays: z.number(),
    averageHoursPerDay: z.number(),
  }),
});

// ステップ1: タスクの分析と優先順位付け
const analyzeTasks = createStep({
  id: "analyze-tasks",
  description: "Analyzes tasks and assigns AI-driven priorities",
  inputSchema: taskListSchema,
  outputSchema: prioritizedTasksSchema,
  execute: async ({ inputData, mastra }) => {
    try {
      // Weather Agentを代用（実際のプロジェクトでは専用のタスクエージェントを作成）
      const agent = mastra?.getAgent("weatherAgent");
      if (!agent) {
        throw new Error("Agent not found - using weatherAgent as fallback");
      }

      const tasks = inputData.tasks;
      const prioritizedTasks = [];

      console.log(`🔍 Analyzing ${tasks.length} tasks for prioritization...`);

      for (const [index, task] of tasks.entries()) {
        console.log(
          `📝 Processing task ${index + 1}/${tasks.length}: ${task.title}`
        );

        const prompt = `
以下のタスクを分析し、1-10のスコアで優先順位を付けてください：

タスク: ${task.title}
説明: ${task.description || "なし"}
見積もり時間: ${task.estimatedHours}時間
締切: ${task.deadline || "なし"}
現在の優先度: ${task.priority || "なし"}
カテゴリ: ${task.category || "なし"}

以下の観点で評価してください：
1. 緊急性 (締切までの時間) - 20%
2. 重要性 (影響度・価値) - 30%
3. 複雑性 (他のタスクとの依存関係) - 20%
4. リソース効率性 (時間対効果) - 30%

10 = 最優先（即座に実行すべき）
1 = 最低優先（後回し可能）

JSON形式で回答してください：
{
  "priority": [1-10のスコア],
  "reasoning": "優先順位の理由を100文字以内で"
}
`;

        const response = await agent.stream([
          {
            role: "user",
            content: prompt,
          },
        ]);

        let responseText = "";
        for await (const chunk of response.textStream) {
          responseText += chunk;
        }

        try {
          // JSONの抽出を試行
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
          const parsed = JSON.parse(jsonStr);

          const aiPriority = Math.max(1, Math.min(10, parsed.priority || 5));

          prioritizedTasks.push({
            ...task,
            aiPriority,
            reasoning: parsed.reasoning || "AI分析により決定",
          });

          console.log(
            `✅ Task "${task.title}" assigned priority: ${aiPriority}/10`
          );
        } catch (error) {
          console.warn(
            `⚠️ Failed to parse AI response for task "${task.title}", using default priority`
          );

          // パースエラーの場合はデフォルト値を使用
          let defaultPriority = 5;

          // 簡単なルールベース優先順位付け
          if (task.priority === "urgent") defaultPriority = 9;
          else if (task.priority === "high") defaultPriority = 7;
          else if (task.priority === "medium") defaultPriority = 5;
          else if (task.priority === "low") defaultPriority = 3;

          // 締切がある場合は優先度を上げる
          if (task.deadline) {
            const deadlineDate = new Date(task.deadline);
            const today = new Date();
            const daysUntilDeadline = Math.ceil(
              (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysUntilDeadline <= 1)
              defaultPriority = Math.min(10, defaultPriority + 3);
            else if (daysUntilDeadline <= 7)
              defaultPriority = Math.min(10, defaultPriority + 2);
            else if (daysUntilDeadline <= 14)
              defaultPriority = Math.min(10, defaultPriority + 1);
          }

          prioritizedTasks.push({
            ...task,
            aiPriority: defaultPriority,
            reasoning: "ルールベースで決定された優先順位",
          });
        }
      }

      // 優先順位でソート
      prioritizedTasks.sort((a, b) => b.aiPriority - a.aiPriority);

      console.log("🎯 Task prioritization completed");
      console.log(`📊 Priority distribution:`);

      const priorityGroups = prioritizedTasks.reduce(
        (acc, task) => {
          const range =
            task.aiPriority >= 8
              ? "High (8-10)"
              : task.aiPriority >= 6
                ? "Medium (6-7)"
                : task.aiPriority >= 4
                  ? "Low-Medium (4-5)"
                  : "Low (1-3)";
          acc[range] = (acc[range] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      Object.entries(priorityGroups).forEach(([range, count]) => {
        console.log(`   ${range}: ${count} tasks`);
      });

      return { tasks: prioritizedTasks };
    } catch (error) {
      console.error("❌ Failed to analyze tasks:", error);
      throw error;
    }
  },
});

// ステップ2: スケジュール作成
const createSchedule = createStep({
  id: "create-schedule",
  description: "Creates an optimized schedule for prioritized tasks",
  inputSchema: prioritizedTasksSchema.extend({
    workingHoursPerDay: z.number().default(8),
    startDate: z.string(),
    excludeWeekends: z.boolean().default(true),
  }),
  outputSchema: scheduleSchema,
  execute: async ({ inputData, mastra }) => {
    try {
      const { tasks, workingHoursPerDay, startDate, excludeWeekends } =
        inputData;

      console.log(`📅 Creating schedule for ${tasks.length} tasks`);
      console.log(`⏰ Working hours per day: ${workingHoursPerDay}h`);
      console.log(`📅 Start date: ${startDate}`);
      console.log(`🏖️ Exclude weekends: ${excludeWeekends ? "Yes" : "No"}`);

      const agent = mastra?.getAgent("weatherAgent");
      if (!agent) {
        throw new Error("Agent not found");
      }

      // 日付のヘルパー関数
      const addDays = (date: Date, days: number): Date => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      };

      const isWeekend = (date: Date): boolean => {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
      };

      const formatTime = (hours: number): string => {
        const h = Math.floor(9 + hours); // 9時開始
        const m = Math.round((hours % 1) * 60);
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      };

      // スケジューリングロジック
      const schedule = [];
      let currentDate = new Date(startDate);
      let currentDayHours = 0;
      let currentDayTasks: any[] = [];
      let taskIndex = 0;
      let totalScheduledHours = 0;

      while (taskIndex < tasks.length) {
        // 週末をスキップ（オプション）
        if (excludeWeekends && isWeekend(currentDate)) {
          if (currentDayTasks.length > 0) {
            schedule.push({
              date: currentDate.toISOString().split("T")[0],
              tasks: [...currentDayTasks],
              totalHours: currentDayHours,
            });
            currentDayTasks = [];
            currentDayHours = 0;
          }
          currentDate = addDays(currentDate, 1);
          continue;
        }

        const task = tasks[taskIndex];

        // 当日の残り時間をチェック
        if (currentDayHours + task.estimatedHours <= workingHoursPerDay) {
          // タスクを当日に追加
          const startTime = formatTime(currentDayHours);
          const endTime = formatTime(currentDayHours + task.estimatedHours);

          currentDayTasks.push({
            taskId: task.id,
            startTime,
            endTime,
            notes: `優先度: ${task.aiPriority}/10 - ${task.reasoning}`,
          });

          currentDayHours += task.estimatedHours;
          totalScheduledHours += task.estimatedHours;
          taskIndex++;

          console.log(
            `📋 Scheduled: "${task.title}" on ${currentDate.toISOString().split("T")[0]} (${startTime}-${endTime})`
          );
        } else {
          // 一日の作業時間を超える場合、次の日に移る
          if (currentDayTasks.length > 0) {
            schedule.push({
              date: currentDate.toISOString().split("T")[0],
              tasks: [...currentDayTasks],
              totalHours: currentDayHours,
            });
          }

          currentDate = addDays(currentDate, 1);
          currentDayHours = 0;
          currentDayTasks = [];
        }
      }

      // 最後の日を追加
      if (currentDayTasks.length > 0) {
        schedule.push({
          date: currentDate.toISOString().split("T")[0],
          tasks: currentDayTasks,
          totalHours: currentDayHours,
        });
      }

      // AIによるスケジュール提案を生成
      const schedulePrompt = `
以下のタスクスケジュールを分析し、最適化の提案をしてください：

スケジュール概要:
- 総タスク数: ${tasks.length}
- 総作業時間: ${totalScheduledHours}時間
- スケジュール期間: ${schedule.length}日間
- 1日平均作業時間: ${(totalScheduledHours / schedule.length).toFixed(1)}時間

${schedule
  .slice(0, 5)
  .map(
    (day) => `
日付: ${day.date} (${day.totalHours}時間)
タスク:
${day.tasks
  .map((t) => {
    const taskInfo = tasks.find((task) => task.id === t.taskId);
    return `- ${t.startTime}-${t.endTime}: ${taskInfo?.title} (優先度: ${taskInfo?.aiPriority}/10)`;
  })
  .join("\n")}
`
  )
  .join("\n")}
${schedule.length > 5 ? `\n... その他 ${schedule.length - 5} 日間` : ""}

以下の観点で提案してください：
1. 効率性の改善点
2. リスク要因の特定
3. 集中力を考慮した配置の最適化
4. 余裕時間の確保
5. 高優先度タスクの早期完了

日本語で具体的かつ実用的な提案を300文字以内で簡潔にまとめてください。
`;

      console.log("🤖 Generating schedule optimization suggestions...");

      const response = await agent.stream([
        {
          role: "user",
          content: schedulePrompt,
        },
      ]);

      let suggestions = "";
      for await (const chunk of response.textStream) {
        suggestions += chunk;
      }

      const summary = {
        totalTasks: tasks.length,
        totalHours: totalScheduledHours,
        totalDays: schedule.length,
        averageHoursPerDay: totalScheduledHours / schedule.length,
      };

      console.log("✅ Schedule created successfully");
      console.log(`📊 Schedule summary:`);
      console.log(`   Total tasks: ${summary.totalTasks}`);
      console.log(`   Total hours: ${summary.totalHours}h`);
      console.log(`   Total days: ${summary.totalDays}`);
      console.log(
        `   Average hours/day: ${summary.averageHoursPerDay.toFixed(1)}h`
      );

      return {
        dailySchedule: schedule,
        suggestions: suggestions.trim(),
        summary,
      };
    } catch (error) {
      console.error("❌ Failed to create schedule:", error);
      throw error;
    }
  },
});

// タスク管理ワークフローの統合
const taskManagementWorkflow = createWorkflow({
  id: "task-management-workflow",
  inputSchema: z.object({
    tasks: z.array(taskSchema),
    workingHoursPerDay: z.number().default(8),
    startDate: z.string(),
    excludeWeekends: z.boolean().default(true),
  }),
  outputSchema: z.object({
    prioritizedTasks: prioritizedTasksSchema,
    schedule: scheduleSchema,
  }),
})
  .then(analyzeTasks)
  .then(createSchedule);

taskManagementWorkflow.commit();

export { taskManagementWorkflow };
