/**
 * MASTRAワークフローのサンプル実行スクリプト
 *
 * 使用方法:
 * node scripts/sample-workflows.js weather
 * node scripts/sample-workflows.js financial
 * node scripts/sample-workflows.js tasks
 */

import { mastra } from "../src/mastra/index.js";

async function runWeatherWorkflow() {
  console.log("🌤️ Starting Weather Workflow...\n");

  try {
    const result = await mastra.workflows.weatherWorkflow.execute({
      city: "東京",
    });

    console.log("✅ Weather Workflow completed successfully!");
    console.log("\n📋 Results:");
    console.log(result.activities);
  } catch (error) {
    console.error("❌ Weather workflow failed:", error.message);
  }
}

async function runFinancialWorkflow() {
  console.log("💰 Starting Financial Analysis Workflow...\n");

  try {
    const result = await mastra.workflows.financialAnalysisWorkflow.execute({
      userId: "sample_user",
    });

    console.log("✅ Financial Analysis completed successfully!");

    console.log("\n📊 Summary:");
    console.log(result.report.summary);

    console.log("\n💡 Top Categories:");
    Object.entries(result.analysis.categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([category, amount]) => {
        console.log(`  - ${category}: ¥${amount.toLocaleString()}`);
      });

    console.log("\n🏪 Top Merchants:");
    result.analysis.topMerchants.slice(0, 3).forEach((merchant, i) => {
      console.log(
        `  ${i + 1}. ${merchant.name}: ¥${merchant.amount.toLocaleString()}`
      );
    });

    console.log(
      "\n💾 Note: Run with --save-report to save HTML report to file"
    );

    // --save-report オプションが指定された場合にHTMLレポートを保存
    if (process.argv.includes("--save-report")) {
      const fs = await import("fs");
      fs.writeFileSync("financial-report.html", result.report.htmlReport);
      console.log("📄 HTML report saved to: financial-report.html");
    }
  } catch (error) {
    console.error("❌ Financial analysis failed:", error.message);
  }
}

async function runTaskWorkflow() {
  console.log("📋 Starting Task Management Workflow...\n");

  const sampleTasks = [
    {
      id: "task1",
      title: "プレゼンテーション資料作成",
      description: "来週の役員会議用の資料を作成する",
      estimatedHours: 4,
      deadline: "2024-01-20",
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
      deadline: "2024-01-25",
      priority: "high",
      category: "開発業務",
    },
    {
      id: "task4",
      title: "チームミーティング準備",
      description: "週次ミーティングのアジェンダ作成",
      estimatedHours: 1,
      deadline: "2024-01-18",
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
  ];

  try {
    const result = await mastra.workflows.taskManagementWorkflow.execute({
      tasks: sampleTasks,
      workingHoursPerDay: 8,
      startDate: new Date().toISOString().split("T")[0], // 今日から開始
      excludeWeekends: true,
    });

    console.log("✅ Task Management completed successfully!");

    console.log("\n🎯 Prioritized Tasks:");
    result.prioritizedTasks.tasks.slice(0, 3).forEach((task, i) => {
      console.log(
        `  ${i + 1}. ${task.title} (Priority: ${task.aiPriority}/10)`
      );
      console.log(`     ${task.reasoning}`);
    });

    console.log("\n📅 Schedule Overview:");
    result.schedule.dailySchedule.slice(0, 3).forEach((day) => {
      console.log(`  ${day.date} (${day.totalHours}h):`);
      day.tasks.forEach((scheduledTask) => {
        const task = result.prioritizedTasks.tasks.find(
          (t) => t.id === scheduledTask.taskId
        );
        console.log(
          `    ${scheduledTask.startTime}-${scheduledTask.endTime}: ${task?.title}`
        );
      });
    });

    if (result.schedule.dailySchedule.length > 3) {
      console.log(
        `    ... and ${result.schedule.dailySchedule.length - 3} more days`
      );
    }

    console.log("\n📊 Summary:");
    console.log(`  Total tasks: ${result.schedule.summary.totalTasks}`);
    console.log(`  Total hours: ${result.schedule.summary.totalHours}h`);
    console.log(`  Total days: ${result.schedule.summary.totalDays}`);
    console.log(
      `  Average hours/day: ${result.schedule.summary.averageHoursPerDay.toFixed(1)}h`
    );

    console.log("\n💡 AI Suggestions:");
    console.log(`  ${result.schedule.suggestions}`);
  } catch (error) {
    console.error("❌ Task management workflow failed:", error.message);
  }
}

async function showHelp() {
  console.log(`
🚀 MASTRA Workflow Samples

使用可能なワークフロー:

  weather    - 天気予報とアクティビティ提案
               例: node scripts/sample-workflows.js weather

  financial  - 金融取引データの分析とレポート生成
               例: node scripts/sample-workflows.js financial
               オプション: --save-report (HTMLレポートを保存)

  tasks      - タスクの優先順位付けとスケジュール作成
               例: node scripts/sample-workflows.js tasks

  help       - このヘルプを表示
               例: node scripts/sample-workflows.js help

💡 Tips:
- 初回実行時は依存関係のダウンロードに時間がかかる場合があります
- OpenAI APIキーが必要です (環境変数 OPENAI_API_KEY に設定)
- 詳細な使用方法は docs/workflow-usage-examples.md を参照してください
`);
}

async function main() {
  const workflow = process.argv[2];

  if (!workflow) {
    console.log("❌ ワークフロー名を指定してください");
    await showHelp();
    process.exit(1);
  }

  console.log("🔧 MASTRA初期化中...");

  // 基本的な設定確認
  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️  OPENAI_API_KEY環境変数が設定されていません");
    console.warn("   一部の機能が正常に動作しない可能性があります");
  }

  console.log("✅ MASTRA準備完了\n");

  switch (workflow.toLowerCase()) {
    case "weather":
      await runWeatherWorkflow();
      break;
    case "financial":
      await runFinancialWorkflow();
      break;
    case "tasks":
      await runTaskWorkflow();
      break;
    case "help":
      await showHelp();
      break;
    default:
      console.log(`❌ 不明なワークフロー: ${workflow}`);
      await showHelp();
      process.exit(1);
  }

  console.log("\n🎉 完了しました!");
}

// エラーハンドリング
process.on("unhandledRejection", (error) => {
  console.error("❌ 予期しないエラーが発生しました:", error);
  process.exit(1);
});

main().catch((error) => {
  console.error("❌ スクリプト実行エラー:", error);
  process.exit(1);
});
