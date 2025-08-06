# MASTRAワークフローの実践例ガイド

このドキュメントでは、MASTRAフレームワークを使用した実用的なワークフローの作成方法を、詳細な解説とともに紹介します。

## 目次

1. [金融分析ワークフロー](#金融分析ワークフロー)
2. [タスク管理ワークフロー](#タスク管理ワークフロー)
3. [コンテンツ作成ワークフロー](#コンテンツ作成ワークフロー)
4. [ワークフロー設計のベストプラクティス](#ワークフロー設計のベストプラクティス)
5. [エラーハンドリングとリトライ戦略](#エラーハンドリングとリトライ戦略)

---

## 金融分析ワークフロー

### 概要

取引データを分析し、支出パターンの分析、予算の提案、そして詳細なレポートを生成するワークフローです。

### ワークフロー構成

```typescript
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

// データスキーマの定義
const transactionSchema = z.object({
  csvData: z.string(),
});

const analysisSchema = z.object({
  totalSpending: z.number(),
  categoryBreakdown: z.record(z.number()),
  topMerchants: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
    })
  ),
  monthlyTrend: z.array(
    z.object({
      month: z.string(),
      amount: z.number(),
    })
  ),
});

const budgetSchema = z.object({
  recommendations: z.string(),
  monthlyBudget: z.record(z.number()),
  savingsPlan: z.string(),
});

const reportSchema = z.object({
  htmlReport: z.string(),
  summary: z.string(),
});
```

### ステップ1: データ取得と前処理

```typescript
const fetchTransactionData = createStep({
  id: "fetch-transaction-data",
  description: "Fetches and preprocesses transaction data",
  inputSchema: z.object({
    userId: z.string().optional(),
    dateRange: z
      .object({
        start: z.string(),
        end: z.string(),
      })
      .optional(),
  }),
  outputSchema: transactionSchema,
  execute: async ({ inputData, mastra }) => {
    // 1. トランザクションデータを取得
    const agent = mastra?.getAgent("financialAgent");
    if (!agent) {
      throw new Error("Financial agent not found");
    }

    // ツールを使用してデータを取得
    const transactionTool = agent.tools?.getTransactionsTool;
    if (!transactionTool) {
      throw new Error("Transaction tool not found");
    }

    const result = await transactionTool.execute({ context: {} });

    // 2. データの妥当性チェック
    if (!result.csvData || result.csvData.trim().length === 0) {
      throw new Error("No transaction data available");
    }

    // 3. 日付フィルタリング（オプション）
    let filteredData = result.csvData;
    if (inputData?.dateRange) {
      // CSVデータを解析して日付でフィルタリング
      const lines = result.csvData.split("\n");
      const header = lines[0];
      const filteredLines = lines.filter((line, index) => {
        if (index === 0) return true; // ヘッダーは保持
        // ここで日付フィルタリングロジックを実装
        return true; // 簡略化のため全データを返す
      });
      filteredData = filteredLines.join("\n");
    }

    return {
      csvData: filteredData,
    };
  },
});
```

### ステップ2: データ分析

```typescript
const analyzeTransactions = createStep({
  id: "analyze-transactions",
  description: "Analyzes transaction data to extract insights",
  inputSchema: transactionSchema,
  outputSchema: analysisSchema,
  execute: async ({ inputData }) => {
    const csvData = inputData.csvData;
    const lines = csvData.split("\n");
    const header = lines[0].split(",");

    // CSVヘッダーのインデックスを取得
    const dateIndex = header.findIndex((h) => h.toLowerCase().includes("date"));
    const amountIndex = header.findIndex((h) =>
      h.toLowerCase().includes("amount")
    );
    const categoryIndex = header.findIndex((h) =>
      h.toLowerCase().includes("category")
    );
    const merchantIndex = header.findIndex(
      (h) =>
        h.toLowerCase().includes("merchant") ||
        h.toLowerCase().includes("description")
    );

    const transactions = lines
      .slice(1)
      .map((line) => {
        const columns = line.split(",");
        return {
          date: columns[dateIndex] || "",
          amount: parseFloat(
            columns[amountIndex]?.replace(/[^0-9.-]/g, "") || "0"
          ),
          category: columns[categoryIndex] || "Unknown",
          merchant: columns[merchantIndex] || "Unknown",
        };
      })
      .filter((t) => t.amount !== 0);

    // 1. 総支出計算
    const totalSpending = transactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    // 2. カテゴリ別集計
    const categoryBreakdown: Record<string, number> = {};
    transactions.forEach((t) => {
      const category = t.category || "その他";
      categoryBreakdown[category] =
        (categoryBreakdown[category] || 0) + Math.abs(t.amount);
    });

    // 3. トップマーチャント（上位5件）
    const merchantTotals: Record<string, number> = {};
    transactions.forEach((t) => {
      const merchant = t.merchant || "Unknown";
      merchantTotals[merchant] =
        (merchantTotals[merchant] || 0) + Math.abs(t.amount);
    });

    const topMerchants = Object.entries(merchantTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    // 4. 月別トレンド
    const monthlyTotals: Record<string, number> = {};
    transactions.forEach((t) => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyTotals[monthKey] =
        (monthlyTotals[monthKey] || 0) + Math.abs(t.amount);
    });

    const monthlyTrend = Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    return {
      totalSpending,
      categoryBreakdown,
      topMerchants,
      monthlyTrend,
    };
  },
});
```

### ステップ3: 予算提案

```typescript
const generateBudgetRecommendations = createStep({
  id: "generate-budget",
  description: "Generates budget recommendations based on spending analysis",
  inputSchema: analysisSchema,
  outputSchema: budgetSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent("financialAgent");
    if (!agent) {
      throw new Error("Financial agent not found");
    }

    const analysisData = inputData;

    const prompt = `
以下の支出分析データに基づいて、詳細な予算提案を作成してください：

総支出: ¥${analysisData.totalSpending.toLocaleString()}

カテゴリ別支出:
${Object.entries(analysisData.categoryBreakdown)
  .map(([category, amount]) => `- ${category}: ¥${amount.toLocaleString()}`)
  .join("\n")}

上位支出先:
${analysisData.topMerchants
  .map(
    (merchant, i) =>
      `${i + 1}. ${merchant.name}: ¥${merchant.amount.toLocaleString()}`
  )
  .join("\n")}

月別支出トレンド:
${analysisData.monthlyTrend
  .map((trend) => `${trend.month}: ¥${trend.amount.toLocaleString()}`)
  .join("\n")}

以下の形式で回答してください：

## 予算提案

### 1. 支出削減の提案
[具体的な削減提案を3つ以上]

### 2. 月別予算配分
[カテゴリごとの推奨月予算]

### 3. 貯蓄計画
[実現可能な貯蓄目標と方法]

### 4. 注意すべきポイント
[支出パターンで気をつけるべき点]

日本円での金額表示を使用し、実用的で実現可能な提案をしてください。
`;

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let recommendationsText = "";
    for await (const chunk of response.textStream) {
      recommendationsText += chunk;
    }

    // 推奨月別予算を現在の支出の80%として計算
    const monthlyBudget: Record<string, number> = {};
    Object.entries(analysisData.categoryBreakdown).forEach(
      ([category, amount]) => {
        const avgMonthly = amount / (analysisData.monthlyTrend.length || 1);
        monthlyBudget[category] = Math.round(avgMonthly * 0.8); // 20%削減目標
      }
    );

    // 貯蓄計画を生成
    const totalMonthlyBudget = Object.values(monthlyBudget).reduce(
      (sum, amount) => sum + amount,
      0
    );
    const currentAvgMonthly =
      analysisData.totalSpending / (analysisData.monthlyTrend.length || 1);
    const potentialSavings = currentAvgMonthly - totalMonthlyBudget;

    const savingsPlan = `月額 ¥${potentialSavings.toLocaleString()} の貯蓄を目標とし、年間 ¥${(potentialSavings * 12).toLocaleString()} の貯蓄が可能です。`;

    return {
      recommendations: recommendationsText,
      monthlyBudget,
      savingsPlan,
    };
  },
});
```

### ステップ4: レポート生成

```typescript
const generateReport = createStep({
  id: "generate-report",
  description: "Generates a comprehensive financial report",
  inputSchema: z.object({
    analysis: analysisSchema,
    budget: budgetSchema,
  }),
  outputSchema: reportSchema,
  execute: async ({ inputData }) => {
    const { analysis, budget } = inputData;

    // HTML レポートの生成
    const htmlReport = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>財務分析レポート</title>
    <style>
        body { font-family: 'Helvetica', sans-serif; margin: 40px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .metric { background: #ecf0f1; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .amount { font-size: 24px; font-weight: bold; color: #e74c3c; }
        .category { margin: 5px 0; padding: 5px; border-left: 4px solid #3498db; }
        .budget-item { background: #d5f4e6; padding: 10px; margin: 5px 0; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #3498db; color: white; }
        .highlight { background-color: #f39c12; color: white; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 財務分析レポート</h1>
        <p><strong>生成日時:</strong> ${new Date().toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}</p>

        <div class="metric">
            <h2>💰 総支出</h2>
            <div class="amount">¥${analysis.totalSpending.toLocaleString()}</div>
        </div>

        <h2>📈 カテゴリ別支出</h2>
        ${Object.entries(analysis.categoryBreakdown)
          .sort(([, a], [, b]) => b - a)
          .map(
            ([category, amount]) => `
            <div class="category">
                <strong>${category}:</strong> ¥${amount.toLocaleString()} 
                <span class="highlight">${((amount / analysis.totalSpending) * 100).toFixed(1)}%</span>
            </div>
          `
          )
          .join("")}

        <h2>🏪 上位支出先</h2>
        <table>
            <tr><th>順位</th><th>店舗/サービス</th><th>支出額</th><th>割合</th></tr>
            ${analysis.topMerchants
              .map(
                (merchant, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${merchant.name}</td>
                    <td>¥${merchant.amount.toLocaleString()}</td>
                    <td>${((merchant.amount / analysis.totalSpending) * 100).toFixed(1)}%</td>
                </tr>
            `
              )
              .join("")}
        </table>

        <h2>📅 月別支出推移</h2>
        <table>
            <tr><th>月</th><th>支出額</th></tr>
            ${analysis.monthlyTrend
              .map(
                (trend) => `
                <tr>
                    <td>${trend.month}</td>
                    <td>¥${trend.amount.toLocaleString()}</td>
                </tr>
            `
              )
              .join("")}
        </table>

        <h2>💡 予算提案</h2>
        <div style="white-space: pre-line; background: #f8f9fa; padding: 20px; border-radius: 5px;">
            ${budget.recommendations}
        </div>

        <h2>🎯 推奨月別予算</h2>
        ${Object.entries(budget.monthlyBudget)
          .sort(([, a], [, b]) => b - a)
          .map(
            ([category, amount]) => `
            <div class="budget-item">
                <strong>${category}:</strong> ¥${amount.toLocaleString()}/月
            </div>
          `
          )
          .join("")}

        <div class="metric">
            <h2>💰 貯蓄計画</h2>
            <p>${budget.savingsPlan}</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    // サマリーの生成
    const topCategory = Object.entries(analysis.categoryBreakdown).sort(
      ([, a], [, b]) => b - a
    )[0];

    const summary = `
📊 財務分析サマリー

総支出: ¥${analysis.totalSpending.toLocaleString()}
最大支出カテゴリ: ${topCategory[0]} (¥${topCategory[1].toLocaleString()})
推奨月間貯蓄: ¥${Object.values(budget.monthlyBudget)
      .reduce(
        (sum, amount) =>
          analysis.totalSpending / (analysis.monthlyTrend.length || 1) - sum,
        0
      )
      .toLocaleString()}

主な改善提案:
• 最大支出カテゴリの見直し
• 月別予算の設定と追跡
• 定期的な支出パターンの見直し
    `.trim();

    return {
      htmlReport,
      summary,
    };
  },
});
```

### ワークフローの統合

```typescript
const financialAnalysisWorkflow = createWorkflow({
  id: "financial-analysis-workflow",
  inputSchema: z.object({
    userId: z.string().optional(),
    dateRange: z
      .object({
        start: z.string(),
        end: z.string(),
      })
      .optional(),
  }),
  outputSchema: z.object({
    report: reportSchema,
    analysis: analysisSchema,
    budget: budgetSchema,
  }),
})
  .then(fetchTransactionData)
  .then(analyzeTransactions)
  .then(generateBudgetRecommendations)
  .then(async ({ inputData }) => {
    // 前のステップの結果を統合
    const analysis = inputData; // analyzeTransactionsの結果
    const budget = inputData; // generateBudgetRecommendationsの結果

    // レポート生成ステップを実行
    const reportResult = await generateReport.execute({
      inputData: { analysis, budget },
    });

    return {
      report: reportResult,
      analysis,
      budget,
    };
  });

financialAnalysisWorkflow.commit();
```

---

## タスク管理ワークフロー

### 概要

タスクリストを分析し、優先順位を付け、効率的なスケジュールを作成するワークフローです。

### 実装例

```typescript
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
    })
  ),
  suggestions: z.string(),
});

// ステップ1: タスクの分析と優先順位付け
const analyzeTasks = createStep({
  id: "analyze-tasks",
  description: "Analyzes tasks and assigns AI-driven priorities",
  inputSchema: taskListSchema,
  outputSchema: prioritizedTasksSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent("taskAgent"); // 新しいエージェントが必要
    if (!agent) {
      throw new Error("Task agent not found");
    }

    const tasks = inputData.tasks;
    const prioritizedTasks = [];

    for (const task of tasks) {
      const prompt = `
以下のタスクを分析し、1-10のスコアで優先順位を付けてください：

タスク: ${task.title}
説明: ${task.description || "なし"}
見積もり時間: ${task.estimatedHours}時間
締切: ${task.deadline || "なし"}
現在の優先度: ${task.priority || "なし"}
カテゴリ: ${task.category || "なし"}

以下の観点で評価してください：
1. 緊急性 (締切までの時間)
2. 重要性 (影響度・価値)
3. 複雑性 (他のタスクとの依存関係)
4. リソース効率性

JSON形式で回答してください：
{
  "priority": [1-10のスコア],
  "reasoning": "優先順位の理由"
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
        const parsed = JSON.parse(responseText);
        prioritizedTasks.push({
          ...task,
          aiPriority: parsed.priority,
          reasoning: parsed.reasoning,
        });
      } catch (error) {
        // パースエラーの場合はデフォルト値を使用
        prioritizedTasks.push({
          ...task,
          aiPriority: 5,
          reasoning: "AI分析でエラーが発生しました",
        });
      }
    }

    // 優先順位でソート
    prioritizedTasks.sort((a, b) => b.aiPriority - a.aiPriority);

    return { tasks: prioritizedTasks };
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
    const { tasks, workingHoursPerDay, startDate, excludeWeekends } = inputData;

    const agent = mastra?.getAgent("taskAgent");
    if (!agent) {
      throw new Error("Task agent not found");
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

    // スケジューリングロジック
    const schedule = [];
    let currentDate = new Date(startDate);
    let currentDayHours = 0;
    let currentDayTasks = [];
    let taskIndex = 0;

    while (taskIndex < tasks.length) {
      // 週末をスキップ（オプション）
      if (excludeWeekends && isWeekend(currentDate)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      const task = tasks[taskIndex];

      // 当日の残り時間をチェック
      if (currentDayHours + task.estimatedHours <= workingHoursPerDay) {
        // タスクを当日に追加
        const startTime = `${9 + Math.floor(currentDayHours)}:${(currentDayHours % 1) * 60}`;
        const endTime = `${9 + Math.floor(currentDayHours + task.estimatedHours)}:${((currentDayHours + task.estimatedHours) % 1) * 60}`;

        currentDayTasks.push({
          taskId: task.id,
          startTime,
          endTime,
          notes: `優先度: ${task.aiPriority}/10 - ${task.reasoning}`,
        });

        currentDayHours += task.estimatedHours;
        taskIndex++;
      } else {
        // 一日の作業時間を超える場合、次の日に移る
        if (currentDayTasks.length > 0) {
          schedule.push({
            date: currentDate.toISOString().split("T")[0],
            tasks: [...currentDayTasks],
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
      });
    }

    // AIによるスケジュール提案を生成
    const schedulePrompt = `
以下のタスクスケジュールを分析し、最適化の提案をしてください：

${schedule
  .map(
    (day) => `
日付: ${day.date}
タスク:
${day.tasks.map((t) => `- ${tasks.find((task) => task.id === t.taskId)?.title} (${t.startTime}-${t.endTime})`).join("\n")}
`
  )
  .join("\n")}

以下の観点で提案してください：
1. 効率性の改善点
2. リスク要因
3. 調整が必要な箇所
4. 集中力を考慮した配置

日本語で具体的かつ実用的な提案をしてください。
`;

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

    return {
      dailySchedule: schedule,
      suggestions,
    };
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
```

---

## コンテンツ作成ワークフロー

### 概要

テーマから記事の構成を作成し、各セクションを執筆し、最終的に完成した記事を生成するワークフローです。

### 実装例

```typescript
// コンテンツ作成用のスキーマ
const contentOutlineSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      estimatedWords: z.number(),
    })
  ),
  conclusion: z.string(),
  targetAudience: z.string(),
  tone: z.string(),
});

const contentSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  wordCount: z.number(),
});

const finalContentSchema = z.object({
  title: z.string(),
  fullContent: z.string(),
  metadata: z.object({
    wordCount: z.number(),
    readingTime: z.number(),
    seoKeywords: z.array(z.string()),
  }),
});

// ステップ1: コンテンツ構成の作成
const createContentOutline = createStep({
  id: "create-content-outline",
  description: "Creates a detailed outline for content creation",
  inputSchema: z.object({
    topic: z.string(),
    targetAudience: z.string().optional(),
    contentType: z
      .enum(["blog", "article", "tutorial", "guide"])
      .default("article"),
    targetWordCount: z.number().default(2000),
    seoKeywords: z.array(z.string()).optional(),
  }),
  outputSchema: contentOutlineSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent("contentAgent"); // 新しいエージェントが必要
    if (!agent) {
      throw new Error("Content agent not found");
    }

    const { topic, targetAudience, contentType, targetWordCount, seoKeywords } =
      inputData;

    const prompt = `
以下の条件でコンテンツの構成を作成してください：

トピック: ${topic}
対象読者: ${targetAudience || "一般読者"}
コンテンツタイプ: ${contentType}
目標文字数: ${targetWordCount}語
SEOキーワード: ${seoKeywords?.join(", ") || "なし"}

以下のJSON形式で回答してください：
{
  "title": "魅力的なタイトル",
  "introduction": "導入部の概要",
  "sections": [
    {
      "title": "セクションタイトル",
      "description": "セクションの内容説明",
      "estimatedWords": 予想文字数
    }
  ],
  "conclusion": "結論部の概要",
  "targetAudience": "ターゲット読者の詳細",
  "tone": "記事のトーン（フォーマル、カジュアルなど）"
}

SEOを意識し、読者に価値を提供する構成にしてください。
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
      return JSON.parse(responseText);
    } catch (error) {
      throw new Error("Failed to parse content outline");
    }
  },
});

// ステップ2: セクション執筆
const writeContentSections = createStep({
  id: "write-content-sections",
  description: "Writes individual sections based on the outline",
  inputSchema: contentOutlineSchema,
  outputSchema: z.object({
    sections: z.array(contentSectionSchema),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent("contentAgent");
    if (!agent) {
      throw new Error("Content agent not found");
    }

    const { title, sections, targetAudience, tone } = inputData;
    const writtenSections = [];

    for (const section of sections) {
      const prompt = `
以下の条件でセクションの内容を執筆してください：

記事タイトル: ${title}
セクションタイトル: ${section.title}
セクション説明: ${section.description}
目標文字数: ${section.estimatedWords}語
対象読者: ${targetAudience}
記事のトーン: ${tone}

要件:
- 読みやすく構造化された文章
- 具体例や実用的な情報を含める
- SEOを意識したキーワードの自然な配置
- ${section.estimatedWords}語程度の分量

セクションの内容のみを返してください（タイトルは含めない）。
`;

      const response = await agent.stream([
        {
          role: "user",
          content: prompt,
        },
      ]);

      let sectionContent = "";
      for await (const chunk of response.textStream) {
        sectionContent += chunk;
      }

      writtenSections.push({
        title: section.title,
        content: sectionContent.trim(),
        wordCount: sectionContent.trim().split(/\s+/).length,
      });
    }

    return { sections: writtenSections };
  },
});

// ステップ3: 最終コンテンツの統合
const assembleContent = createStep({
  id: "assemble-content",
  description: "Assembles all sections into final content with metadata",
  inputSchema: z.object({
    outline: contentOutlineSchema,
    sections: z.array(contentSectionSchema),
  }),
  outputSchema: finalContentSchema,
  execute: async ({ inputData, mastra }) => {
    const { outline, sections } = inputData;

    const agent = mastra?.getAgent("contentAgent");
    if (!agent) {
      throw new Error("Content agent not found");
    }

    // 導入文の生成
    const introPrompt = `
以下の記事構成に基づいて、魅力的な導入文を作成してください：

タイトル: ${outline.title}
導入部概要: ${outline.introduction}
対象読者: ${outline.targetAudience}
トーン: ${outline.tone}

セクション概要:
${sections.map((s) => `- ${s.title}`).join("\n")}

読者の関心を引き、記事の価値を示す導入文を300-400語で作成してください。
`;

    const introResponse = await agent.stream([
      {
        role: "user",
        content: introPrompt,
      },
    ]);

    let introduction = "";
    for await (const chunk of introResponse.textStream) {
      introduction += chunk;
    }

    // 結論文の生成
    const conclusionPrompt = `
以下の記事構成に基づいて、効果的な結論文を作成してください：

タイトル: ${outline.title}
結論部概要: ${outline.conclusion}
対象読者: ${outline.targetAudience}

セクション内容:
${sections.map((s) => `## ${s.title}\n${s.content.substring(0, 200)}...`).join("\n\n")}

記事の内容を要約し、読者にアクションを促す結論文を200-300語で作成してください。
`;

    const conclusionResponse = await agent.stream([
      {
        role: "user",
        content: conclusionPrompt,
      },
    ]);

    let conclusion = "";
    for await (const chunk of conclusionResponse.textStream) {
      conclusion += chunk;
    }

    // コンテンツの統合
    const fullContent = `
# ${outline.title}

${introduction.trim()}

${sections
  .map(
    (section) => `
## ${section.title}

${section.content}
`
  )
  .join("\n")}

## まとめ

${conclusion.trim()}
    `.trim();

    // メタデータの計算
    const totalWords = fullContent.split(/\s+/).length;
    const readingTime = Math.ceil(totalWords / 200); // 1分間に200語として計算

    // SEOキーワードの抽出
    const keywordPrompt = `
以下のコンテンツから重要なSEOキーワードを5-10個抽出してください：

${fullContent.substring(0, 1000)}...

JSON配列形式で返してください：
["キーワード1", "キーワード2", ...]
`;

    const keywordResponse = await agent.stream([
      {
        role: "user",
        content: keywordPrompt,
      },
    ]);

    let keywordText = "";
    for await (const chunk of keywordResponse.textStream) {
      keywordText += chunk;
    }

    let seoKeywords = [];
    try {
      seoKeywords = JSON.parse(keywordText);
    } catch (error) {
      seoKeywords = ["content", "article", "guide"];
    }

    return {
      title: outline.title,
      fullContent,
      metadata: {
        wordCount: totalWords,
        readingTime,
        seoKeywords,
      },
    };
  },
});

// コンテンツ作成ワークフローの統合
const contentCreationWorkflow = createWorkflow({
  id: "content-creation-workflow",
  inputSchema: z.object({
    topic: z.string(),
    targetAudience: z.string().optional(),
    contentType: z
      .enum(["blog", "article", "tutorial", "guide"])
      .default("article"),
    targetWordCount: z.number().default(2000),
    seoKeywords: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    outline: contentOutlineSchema,
    sections: z.array(contentSectionSchema),
    finalContent: finalContentSchema,
  }),
})
  .then(createContentOutline)
  .then(writeContentSections)
  .then(async ({ inputData }) => {
    const outline = inputData; // createContentOutlineの結果
    const sectionsResult = inputData; // writeContentSectionsの結果

    const finalContentResult = await assembleContent.execute({
      inputData: {
        outline,
        sections: sectionsResult.sections,
      },
    });

    return {
      outline,
      sections: sectionsResult.sections,
      finalContent: finalContentResult,
    };
  });

contentCreationWorkflow.commit();
```

---

## ワークフロー設計のベストプラクティス

### 1. スキーマ設計

```typescript
// ✅ 良い例：明確で型安全なスキーマ
const userInputSchema = z.object({
  email: z.string().email(),
  preferences: z.object({
    language: z.enum(["ja", "en"]),
    notifications: z.boolean(),
  }),
  metadata: z.record(z.string()).optional(),
});

// ❌ 悪い例：曖昧で型安全でない
const badSchema = z.object({
  data: z.any(),
  options: z.object({}),
});
```

### 2. エラーハンドリング

```typescript
const robustStep = createStep({
  id: "robust-step",
  execute: async ({ inputData }) => {
    try {
      // メイン処理
      const result = await someAsyncOperation(inputData);

      // 結果の検証
      if (!result || !result.isValid) {
        throw new Error("Invalid result from operation");
      }

      return result;
    } catch (error) {
      // エラーログの記録
      console.error("Step failed:", error);

      // 適切なエラーメッセージ
      throw new Error(`Processing failed: ${error.message}`);
    }
  },
});
```

### 3. 進捗追跡

```typescript
const trackableStep = createStep({
  id: "trackable-step",
  execute: async ({ inputData, mastra }) => {
    const items = inputData.items;
    const results = [];

    for (let i = 0; i < items.length; i++) {
      console.log(`Processing item ${i + 1}/${items.length}`);

      const result = await processItem(items[i]);
      results.push(result);

      // 進捗をログに記録
      if ((i + 1) % 10 === 0) {
        console.log(`Completed ${i + 1} items`);
      }
    }

    return { results };
  },
});
```

### 4. 設定の外部化

```typescript
// 設定ファイル: config.ts
export const workflowConfig = {
  maxRetries: 3,
  timeout: 30000,
  batchSize: 10,
  apiEndpoints: {
    external: process.env.EXTERNAL_API_URL,
    backup: process.env.BACKUP_API_URL,
  },
};

// ワークフローでの使用
const configurableStep = createStep({
  id: "configurable-step",
  execute: async ({ inputData }) => {
    const config = workflowConfig;

    // 設定に基づいた処理
    const batchSize = config.batchSize;
    const items = inputData.items;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processBatch(batch, config);
    }

    return { processed: items.length };
  },
});
```

## エラーハンドリングとリトライ戦略

### 1. 指数バックオフでのリトライ

```typescript
const retryableStep = createStep({
  id: "retryable-step",
  execute: async ({ inputData }) => {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await unreliableOperation(inputData);
        return result;
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1秒, 2秒, 4秒
          console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Operation failed after ${maxRetries} attempts: ${lastError.message}`
    );
  },
});
```

### 2. 回路ブレーカーパターン

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1分

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "open";
    }
  }
}

const circuitBreaker = new CircuitBreaker();

const resilientStep = createStep({
  id: "resilient-step",
  execute: async ({ inputData }) => {
    return await circuitBreaker.execute(async () => {
      return await externalApiCall(inputData);
    });
  },
});
```

### 3. 部分的失敗の処理

```typescript
const batchProcessingStep = createStep({
  id: "batch-processing",
  execute: async ({ inputData }) => {
    const items = inputData.items;
    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        const result = await processItem(item);
        results.push({ item, result, status: "success" });
      } catch (error) {
        errors.push({ item, error: error.message, status: "failed" });

        // 重要でないエラーの場合は続行
        if (!isCriticalError(error)) {
          continue;
        }

        // 重要なエラーの場合は中断
        throw new Error(
          `Critical error processing item ${item.id}: ${error.message}`
        );
      }
    }

    return {
      results,
      errors,
      summary: {
        total: items.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  },
});
```

このガイドを参考に、様々な用途に応じた実用的なMASTRAワークフローを作成できます。各例は実際のビジネスシナリオに基づいており、拡張・カスタマイズが可能です。
