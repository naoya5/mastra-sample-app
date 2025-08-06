# MASTRAワークフロー使用例ガイド

このドキュメントでは、実装済みのMASTRAワークフローの具体的な使用方法と実際のサンプルデータを示します。

## 目次

1. [天気予報ワークフロー](#天気予報ワークフロー)
2. [金融分析ワークフロー](#金融分析ワークフロー)
3. [タスク管理ワークフロー](#タスク管理ワークフロー)
4. [ワークフローの実行方法](#ワークフローの実行方法)
5. [トラブルシューティング](#トラブルシューティング)

---

## 天気予報ワークフロー

### 概要

指定された都市の天気予報を取得し、AIエージェントがその天気に基づいて最適なアクティビティを提案するワークフローです。

### 入力例

```typescript
const weatherInput = {
  city: "東京",
};
```

### 実行方法

```typescript
import { mastra } from "./src/mastra";

async function runWeatherWorkflow() {
  try {
    const result = await mastra.workflows.weatherWorkflow.execute({
      city: "京都",
    });

    console.log("🌤️ Weather Workflow Results:");
    console.log(result.activities);
  } catch (error) {
    console.error("❌ Weather workflow failed:", error);
  }
}

runWeatherWorkflow();
```

### 期待される出力例

```
📅 金曜日, 12月 15日, 2023
═══════════════════════════

🌡️ WEATHER SUMMARY
• Conditions: 晴れ
• Temperature: 8°C to 15°C
• Precipitation: 10% chance

🌅 MORNING ACTIVITIES
Outdoor:
• 清水寺参拝 - 早朝の静寂な境内で参拝と紅葉鑑賞
  Best timing: 6:00-8:00
  Note: 朝の冷え込みに注意、防寒着推奨

🌞 AFTERNOON ACTIVITIES
Outdoor:
• 嵐山散策 - 竹林の小径ウォーキング
  Best timing: 13:00-15:00
  Note: 日中の暖かい時間帯が最適

🏠 INDOOR ALTERNATIVES
• 京都国立博物館 - 文化財鑑賞
  Ideal for: 雨天時や寒さが厳しい場合

⚠️ SPECIAL CONSIDERATIONS
• 朝晩の冷え込みに注意
• 日中は紫外線対策も忘れずに
```

---

## 金融分析ワークフロー

### 概要

取引データを分析し、支出パターンの分析、予算の提案、詳細なレポートを生成するワークフローです。

### 入力例

```typescript
const financialInput = {
  userId: "user123", // オプション
  dateRange: {
    // オプション
    start: "2023-01-01",
    end: "2023-12-31",
  },
};
```

### 実行方法

```typescript
import { mastra } from "./src/mastra";

async function runFinancialAnalysis() {
  try {
    console.log("💰 Starting financial analysis...");

    const result = await mastra.workflows.financialAnalysisWorkflow.execute({
      userId: "sample_user",
      dateRange: {
        start: "2023-01-01",
        end: "2023-12-31",
      },
    });

    console.log("📊 Financial Analysis Results:");
    console.log("\n=== SUMMARY ===");
    console.log(result.report.summary);

    console.log("\n=== ANALYSIS ===");
    console.log(
      `Total Spending: ¥${result.analysis.totalSpending.toLocaleString()}`
    );

    console.log("\nTop Categories:");
    Object.entries(result.analysis.categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([category, amount]) => {
        console.log(`  - ${category}: ¥${amount.toLocaleString()}`);
      });

    console.log("\nTop Merchants:");
    result.analysis.topMerchants.slice(0, 3).forEach((merchant, i) => {
      console.log(
        `  ${i + 1}. ${merchant.name}: ¥${merchant.amount.toLocaleString()}`
      );
    });

    console.log("\n=== BUDGET RECOMMENDATIONS ===");
    console.log(result.budget.savingsPlan);

    // HTMLレポートをファイルに保存
    const fs = require("fs");
    fs.writeFileSync("financial-report.html", result.report.htmlReport);
    console.log("💾 Detailed HTML report saved to: financial-report.html");
  } catch (error) {
    console.error("❌ Financial analysis failed:", error);
  }
}

runFinancialAnalysis();
```

### サンプル出力

```
💰 Starting financial analysis...
✅ Transaction data fetched successfully
📊 Analyzing 150 transactions
💰 Total spending: ¥245,680
📈 Categories analyzed: 8
🤖 Generating budget recommendations with AI...
💡 Budget recommendations generated successfully
📝 Generating comprehensive report...
✅ Report generated successfully

📊 Financial Analysis Results:

=== SUMMARY ===
📊 財務分析サマリー

総支出: ¥245,680
最大支出カテゴリ: 食費 (¥85,420)
月平均支出: ¥20,473
推奨月間貯蓄: ¥4,095

主な改善提案:
• 最大支出カテゴリ「食費」の見直し
• 月別予算の設定と追跡
• 定期的な支出パターンの見直し
• 月額¥4,095の貯蓄目標

=== ANALYSIS ===
Total Spending: ¥245,680

Top Categories:
  - 食費: ¥85,420
  - 交通費: ¥42,150
  - 娯楽: ¥38,900

Top Merchants:
  1. コンビニA: ¥25,480
  2. スーパーB: ¥22,350
  3. レストランC: ¥18,720

=== BUDGET RECOMMENDATIONS ===
月額 ¥4,095 の貯蓄を目標とし、年間 ¥49,140 の貯蓄が可能です。

💾 Detailed HTML report saved to: financial-report.html
```

---

## タスク管理ワークフロー

### 概要

タスクリストを分析し、AIによる優先順位付けを行い、効率的なスケジュールを作成するワークフローです。

### 入力例

```typescript
const taskInput = {
  tasks: [
    {
      id: "task1",
      title: "プレゼンテーション資料作成",
      description: "来週の役員会議用の資料を作成する",
      estimatedHours: 4,
      deadline: "2023-12-20",
      priority: "high",
      category: "重要業務",
    },
    {
      id: "task2",
      title: "メール返信",
      description: "溜まっているメールの返信作業",
      estimatedHours: 2,
      priority: "medium",
      category: "日常業務",
    },
    {
      id: "task3",
      title: "新機能の設計書作成",
      description: "次四半期リリース予定の新機能の詳細設計",
      estimatedHours: 6,
      deadline: "2023-12-25",
      priority: "high",
      category: "開発業務",
    },
    {
      id: "task4",
      title: "チームミーティング準備",
      description: "週次ミーティングのアジェンダ作成",
      estimatedHours: 1,
      deadline: "2023-12-18",
      priority: "medium",
      category: "マネジメント",
    },
    {
      id: "task5",
      title: "技術書読書",
      description: "スキルアップのための技術書読書",
      estimatedHours: 3,
      priority: "low",
      category: "自己研鑽",
    },
  ],
  workingHoursPerDay: 8,
  startDate: "2023-12-15",
  excludeWeekends: true,
};
```

### 実行方法

```typescript
import { mastra } from "./src/mastra";

async function runTaskManagement() {
  try {
    console.log("📋 Starting task management workflow...");

    const result = await mastra.workflows.taskManagementWorkflow.execute({
      tasks: [
        {
          id: "task1",
          title: "プレゼンテーション資料作成",
          description: "来週の役員会議用の資料を作成する",
          estimatedHours: 4,
          deadline: "2023-12-20",
          priority: "high",
          category: "重要業務",
        },
        {
          id: "task2",
          title: "メール返信",
          description: "溜まっているメールの返信作業",
          estimatedHours: 2,
          priority: "medium",
          category: "日常業務",
        },
        {
          id: "task3",
          title: "新機能の設計書作成",
          description: "次四半期リリース予定の新機能の詳細設計",
          estimatedHours: 6,
          deadline: "2023-12-25",
          priority: "high",
          category: "開発業務",
        },
        {
          id: "task4",
          title: "チームミーティング準備",
          description: "週次ミーティングのアジェンダ作成",
          estimatedHours: 1,
          deadline: "2023-12-18",
          priority: "medium",
          category: "マネジメント",
        },
        {
          id: "task5",
          title: "技術書読書",
          description: "スキルアップのための技術書読書",
          estimatedHours: 3,
          priority: "low",
          category: "自己研鑽",
        },
      ],
      workingHoursPerDay: 8,
      startDate: "2023-12-15",
      excludeWeekends: true,
    });

    console.log("🎯 Task Management Results:");

    console.log("\n=== PRIORITIZED TASKS ===");
    result.prioritizedTasks.tasks.forEach((task, i) => {
      console.log(`${i + 1}. ${task.title}`);
      console.log(`   Priority: ${task.aiPriority}/10`);
      console.log(`   Reasoning: ${task.reasoning}`);
      console.log(`   Hours: ${task.estimatedHours}h`);
      console.log("");
    });

    console.log("=== SCHEDULE ===");
    result.schedule.dailySchedule.forEach((day) => {
      console.log(`\n📅 ${day.date} (${day.totalHours}h)`);
      day.tasks.forEach((scheduledTask) => {
        const task = result.prioritizedTasks.tasks.find(
          (t) => t.id === scheduledTask.taskId
        );
        console.log(
          `  ${scheduledTask.startTime}-${scheduledTask.endTime}: ${task?.title}`
        );
      });
    });

    console.log("\n=== SUMMARY ===");
    console.log(`Total tasks: ${result.schedule.summary.totalTasks}`);
    console.log(`Total hours: ${result.schedule.summary.totalHours}h`);
    console.log(`Total days: ${result.schedule.summary.totalDays}`);
    console.log(
      `Average hours/day: ${result.schedule.summary.averageHoursPerDay.toFixed(1)}h`
    );

    console.log("\n=== AI SUGGESTIONS ===");
    console.log(result.schedule.suggestions);
  } catch (error) {
    console.error("❌ Task management workflow failed:", error);
  }
}

runTaskManagement();
```

### サンプル出力

```
📋 Starting task management workflow...
🔍 Analyzing 5 tasks for prioritization...
📝 Processing task 1/5: プレゼンテーション資料作成
✅ Task "プレゼンテーション資料作成" assigned priority: 9/10
📝 Processing task 2/5: メール返信
✅ Task "メール返信" assigned priority: 5/10
📝 Processing task 3/5: 新機能の設計書作成
✅ Task "新機能の設計書作成" assigned priority: 8/10
📝 Processing task 4/5: チームミーティング準備
✅ Task "チームミーティング準備" assigned priority: 7/10
📝 Processing task 5/5: 技術書読書
✅ Task "技術書読書" assigned priority: 3/10

🎯 Task prioritization completed
📊 Priority distribution:
   High (8-10): 3 tasks
   Medium (6-7): 1 tasks
   Low-Medium (4-5): 1 tasks

📅 Creating schedule for 5 tasks
⏰ Working hours per day: 8h
📅 Start date: 2023-12-15
🏖️ Exclude weekends: Yes

🎯 Task Management Results:

=== PRIORITIZED TASKS ===
1. プレゼンテーション資料作成
   Priority: 9/10
   Reasoning: 締切が近く、役員会議という重要な場面での使用予定のため最優先
   Hours: 4h

2. 新機能の設計書作成
   Priority: 8/10
   Reasoning: 大きな工数と開発への影響度を考慮し高優先度で設定
   Hours: 6h

3. チームミーティング準備
   Priority: 7/10
   Reasoning: 締切が最も近く、チーム運営に直結するため高優先度
   Hours: 1h

4. メール返信
   Priority: 5/10
   Reasoning: 日常業務で重要度は中程度、緊急性も中程度
   Hours: 2h

5. 技術書読書
   Priority: 3/10
   Reasoning: 自己研鑽で重要だが緊急性は低く、時間に余裕がある時に実施
   Hours: 3h

=== SCHEDULE ===

📅 2023-12-15 (8h)
  09:00-13:00: プレゼンテーション資料作成
  13:00-14:00: チームミーティング準備
  14:00-17:00: 技術書読書

📅 2023-12-18 (8h)
  09:00-15:00: 新機能の設計書作成
  15:00-17:00: メール返信

=== SUMMARY ===
Total tasks: 5
Total hours: 16h
Total days: 2
Average hours/day: 8.0h

=== AI SUGGESTIONS ===
効率性改善点：プレゼン資料作成を午前中の集中力が高い時間に配置済み。
リスク要因：新機能設計書は6時間と長時間作業のため、適度な休憩を挟むこと。
集中力配慮：メール返信を午後の疲れが出やすい時間に配置し、単純作業で調整。
余裕確保：週末を除外しているため平日のみでスケジュール完了可能。
```

---

## ワークフローの実行方法

### 1. 開発環境での実行

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# 別のターミナルでワークフローを実行
node -e "
import('./src/mastra/index.js').then(async ({ mastra }) => {
  try {
    const result = await mastra.workflows.weatherWorkflow.execute({
      city: '東京'
    });
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});
"
```

### 2. TypeScriptでの実行スクリプト

`scripts/run-workflows.ts`を作成：

```typescript
import { mastra } from "../src/mastra";

async function main() {
  const workflowName = process.argv[2];

  switch (workflowName) {
    case "weather":
      await runWeatherWorkflow();
      break;
    case "financial":
      await runFinancialWorkflow();
      break;
    case "tasks":
      await runTaskWorkflow();
      break;
    default:
      console.log("Available workflows: weather, financial, tasks");
  }
}

async function runWeatherWorkflow() {
  const result = await mastra.workflows.weatherWorkflow.execute({
    city: "大阪",
  });
  console.log(result);
}

async function runFinancialWorkflow() {
  const result = await mastra.workflows.financialAnalysisWorkflow.execute({});
  console.log(result.report.summary);
}

async function runTaskWorkflow() {
  const result = await mastra.workflows.taskManagementWorkflow.execute({
    tasks: [
      {
        id: "1",
        title: "サンプルタスク",
        estimatedHours: 2,
        priority: "medium",
      },
    ],
    workingHoursPerDay: 8,
    startDate: new Date().toISOString().split("T")[0],
    excludeWeekends: true,
  });
  console.log(result);
}

main().catch(console.error);
```

実行：

```bash
npx tsx scripts/run-workflows.ts weather
npx tsx scripts/run-workflows.ts financial
npx tsx scripts/run-workflows.ts tasks
```

### 3. REST API経由での実行

MASTRAは自動でREST APIを生成します：

```bash
# 開発サーバー起動後、以下のエンドポイントが利用可能
POST http://localhost:3000/workflows/weather-workflow/execute
POST http://localhost:3000/workflows/financial-analysis-workflow/execute
POST http://localhost:3000/workflows/task-management-workflow/execute

# curl例
curl -X POST http://localhost:3000/workflows/weather-workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"city": "京都"}'
```

---

## トラブルシューティング

### 1. 共通的な問題

#### エラー: "Agent not found"

```bash
# エージェントの登録を確認
console.log(Object.keys(mastra.agents)); // 利用可能なエージェント一覧
```

#### エラー: "Tool not found"

```bash
# ツールの登録を確認
const agent = mastra.getAgent('financialAgent');
console.log(Object.keys(agent.tools)); // 利用可能なツール一覧
```

#### エラー: CSV データが取得できない

```typescript
// デバッグ用：直接ツールを実行
import { getTransactionsTool } from "./src/mastra/tools/get-transactions-tool";

try {
  const result = await getTransactionsTool.execute({ context: {} });
  console.log("CSV Data length:", result.csvData.length);
  console.log("First 200 chars:", result.csvData.substring(0, 200));
} catch (error) {
  console.error("Tool execution failed:", error);
}
```

### 2. ワークフロー固有の問題

#### 金融分析ワークフロー

- **問題**: CSVデータの形式が期待と異なる
- **解決**: `analyzeTransactions`ステップでヘッダー検出ロジックを確認

#### タスク管理ワークフロー

- **問題**: AI の応答がJSONとしてパースできない
- **解決**: ルールベースのフォールバック機能が動作するか確認

#### 天気予報ワークフロー

- **問題**: 都市名が見つからない
- **解決**: 英語名または主要都市名を使用

### 3. パフォーマンス最適化

```typescript
// 大量データ処理時のバッチ処理例
const batchSize = 100;
const batches = [];
for (let i = 0; i < largeDataSet.length; i += batchSize) {
  batches.push(largeDataSet.slice(i, i + batchSize));
}

for (const batch of batches) {
  await processBatch(batch);
  console.log(
    `Processed batch ${batches.indexOf(batch) + 1}/${batches.length}`
  );
}
```

### 4. デバッグ用ログの有効化

```typescript
// src/mastra/index.ts でログレベルを変更
logger: new PinoLogger({
  name: "Mastra",
  level: "debug", // info から debug に変更
}),
```

このガイドを参考に、各ワークフローを実際の業務で活用してください。必要に応じてパラメータや処理ロジックをカスタマイズすることで、より具体的な用途に対応できます。
