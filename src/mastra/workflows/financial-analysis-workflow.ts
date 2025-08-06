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

// ステップ1: データ取得と前処理
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

    // getTransactionsToolを直接使用
    const getTransactionsTool = agent.tools?.getTransactionsTool;
    if (!getTransactionsTool) {
      throw new Error("Transaction tool not found");
    }

    try {
      const result = await getTransactionsTool.execute({ context: {} });

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
          // 実際の実装では日付解析とフィルタリングを行う
          return true; // 簡略化のため全データを返す
        });
        filteredData = filteredLines.join("\n");
      }

      console.log("✅ Transaction data fetched successfully");
      return {
        csvData: filteredData,
      };
    } catch (error) {
      console.error("❌ Failed to fetch transaction data:", error);
      throw error;
    }
  },
});

// ステップ2: データ分析
const analyzeTransactions = createStep({
  id: "analyze-transactions",
  description: "Analyzes transaction data to extract insights",
  inputSchema: transactionSchema,
  outputSchema: analysisSchema,
  execute: async ({ inputData }) => {
    try {
      const csvData = inputData.csvData;
      const lines = csvData
        .split("\n")
        .filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        throw new Error("Insufficient transaction data");
      }

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());

      // CSVヘッダーのインデックスを取得
      const dateIndex = header.findIndex((h) => h.includes("date"));
      const amountIndex = header.findIndex(
        (h) => h.includes("amount") || h.includes("金額")
      );
      const categoryIndex = header.findIndex(
        (h) => h.includes("category") || h.includes("カテゴリ")
      );
      const merchantIndex = header.findIndex(
        (h) =>
          h.includes("merchant") ||
          h.includes("description") ||
          h.includes("店舗") ||
          h.includes("説明")
      );

      if (amountIndex === -1) {
        throw new Error("Amount column not found in CSV data");
      }

      const transactions = lines
        .slice(1)
        .map((line, index) => {
          const columns = line.split(",").map((col) => col.trim());
          const amountStr = columns[amountIndex] || "0";
          const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ""));

          return {
            index: index + 1,
            date: columns[dateIndex] || new Date().toISOString(),
            amount: isNaN(amount) ? 0 : amount,
            category: columns[categoryIndex] || "未分類",
            merchant: columns[merchantIndex] || "不明",
          };
        })
        .filter((t) => t.amount !== 0);

      console.log(`📊 Analyzing ${transactions.length} transactions`);

      // 1. 総支出計算（負の値は支出として扱う）
      const totalSpending = transactions.reduce((sum, t) => {
        return sum + (t.amount < 0 ? Math.abs(t.amount) : 0);
      }, 0);

      // 2. カテゴリ別集計
      const categoryBreakdown: Record<string, number> = {};
      transactions.forEach((t) => {
        if (t.amount < 0) {
          // 支出のみを集計
          const category = t.category || "その他";
          categoryBreakdown[category] =
            (categoryBreakdown[category] || 0) + Math.abs(t.amount);
        }
      });

      // 3. トップマーチャント（上位5件）
      const merchantTotals: Record<string, number> = {};
      transactions.forEach((t) => {
        if (t.amount < 0) {
          // 支出のみを集計
          const merchant = t.merchant || "不明";
          merchantTotals[merchant] =
            (merchantTotals[merchant] || 0) + Math.abs(t.amount);
        }
      });

      const topMerchants = Object.entries(merchantTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount }));

      // 4. 月別トレンド
      const monthlyTotals: Record<string, number> = {};
      transactions.forEach((t) => {
        if (t.amount < 0) {
          // 支出のみを集計
          try {
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            monthlyTotals[monthKey] =
              (monthlyTotals[monthKey] || 0) + Math.abs(t.amount);
          } catch (error) {
            // 日付パースエラーの場合は現在月に追加
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            monthlyTotals[monthKey] =
              (monthlyTotals[monthKey] || 0) + Math.abs(t.amount);
          }
        }
      });

      const monthlyTrend = Object.entries(monthlyTotals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));

      console.log(`💰 Total spending: ¥${totalSpending.toLocaleString()}`);
      console.log(
        `📈 Categories analyzed: ${Object.keys(categoryBreakdown).length}`
      );

      return {
        totalSpending,
        categoryBreakdown,
        topMerchants,
        monthlyTrend,
      };
    } catch (error) {
      console.error("❌ Failed to analyze transactions:", error);
      throw error;
    }
  },
});

// ステップ3: 予算提案
const generateBudgetRecommendations = createStep({
  id: "generate-budget",
  description: "Generates budget recommendations based on spending analysis",
  inputSchema: analysisSchema,
  outputSchema: budgetSchema,
  execute: async ({ inputData, mastra }) => {
    try {
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
  .sort(([, a], [, b]) => b - a)
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

      console.log("🤖 Generating budget recommendations with AI...");

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
          const avgMonthly =
            amount / Math.max(analysisData.monthlyTrend.length, 1);
          monthlyBudget[category] = Math.round(avgMonthly * 0.8); // 20%削減目標
        }
      );

      // 貯蓄計画を生成
      const totalMonthlyBudget = Object.values(monthlyBudget).reduce(
        (sum, amount) => sum + amount,
        0
      );
      const currentAvgMonthly =
        analysisData.totalSpending /
        Math.max(analysisData.monthlyTrend.length, 1);
      const potentialSavings = Math.max(
        0,
        currentAvgMonthly - totalMonthlyBudget
      );

      const savingsPlan = `月額 ¥${potentialSavings.toLocaleString()} の貯蓄を目標とし、年間 ¥${(potentialSavings * 12).toLocaleString()} の貯蓄が可能です。`;

      console.log("💡 Budget recommendations generated successfully");

      return {
        recommendations: recommendationsText,
        monthlyBudget,
        savingsPlan,
      };
    } catch (error) {
      console.error("❌ Failed to generate budget recommendations:", error);
      throw error;
    }
  },
});

// ステップ4: レポート生成
const generateReport = createStep({
  id: "generate-report",
  description: "Generates a comprehensive financial report",
  inputSchema: z.object({
    analysis: analysisSchema,
    budget: budgetSchema,
  }),
  outputSchema: reportSchema,
  execute: async ({ inputData }) => {
    try {
      const { analysis, budget } = inputData;

      console.log("📝 Generating comprehensive report...");

      // HTML レポートの生成
      const htmlReport = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>財務分析レポート</title>
    <style>
        body { 
          font-family: 'Helvetica Neue', Arial, sans-serif; 
          margin: 40px; 
          background-color: #f5f7fa; 
          color: #333;
        }
        .container { 
          max-width: 900px; 
          margin: 0 auto; 
          background: white; 
          padding: 40px; 
          border-radius: 12px; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        h1 { 
          color: #2c3e50; 
          border-bottom: 4px solid #3498db; 
          padding-bottom: 15px; 
          font-size: 2.5em;
          margin-bottom: 30px;
        }
        h2 { 
          color: #34495e; 
          margin-top: 40px; 
          font-size: 1.5em;
          border-left: 4px solid #3498db;
          padding-left: 15px;
        }
        .metric { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white;
          padding: 25px; 
          margin: 20px 0; 
          border-radius: 10px; 
          text-align: center;
        }
        .amount { 
          font-size: 2.5em; 
          font-weight: bold; 
          margin-top: 10px;
        }
        .category { 
          margin: 8px 0; 
          padding: 12px; 
          border-left: 4px solid #3498db; 
          background: #f8f9fa;
          border-radius: 0 5px 5px 0;
        }
        .budget-item { 
          background: #d5f4e6; 
          padding: 15px; 
          margin: 8px 0; 
          border-radius: 8px; 
          border-left: 4px solid #27ae60;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0; 
          background: white;
        }
        th, td { 
          padding: 15px; 
          text-align: left; 
          border-bottom: 1px solid #ddd; 
        }
        th { 
          background-color: #3498db; 
          color: white; 
          font-weight: 600;
        }
        tr:hover { background-color: #f5f5f5; }
        .highlight { 
          background-color: #f39c12; 
          color: white; 
          padding: 4px 8px; 
          border-radius: 4px; 
          font-weight: bold;
        }
        .recommendations {
          background: #f8f9fa;
          padding: 25px;
          border-radius: 8px;
          border-left: 4px solid #f39c12;
          white-space: pre-line;
          line-height: 1.6;
        }
        .savings-plan {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          font-size: 1.2em;
        }
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
            <h2 style="color: white; border: none; margin: 0; padding: 0;">💰 総支出</h2>
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
                    <td><strong>#${i + 1}</strong></td>
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

        <h2>💡 AI による予算提案</h2>
        <div class="recommendations">
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

        <div class="savings-plan">
            <h2 style="color: white; border: none; margin: 0 0 10px 0; padding: 0;">💰 貯蓄計画</h2>
            ${budget.savingsPlan}
        </div>
    </div>
</body>
</html>
      `.trim();

      // サマリーの生成
      const topCategory = Object.entries(analysis.categoryBreakdown).sort(
        ([, a], [, b]) => b - a
      )[0];

      const totalMonthlyBudget = Object.values(budget.monthlyBudget).reduce(
        (sum, amount) => sum + amount,
        0
      );
      const currentAvgMonthly =
        analysis.totalSpending / Math.max(analysis.monthlyTrend.length, 1);
      const potentialSavings = Math.max(
        0,
        currentAvgMonthly - totalMonthlyBudget
      );

      const summary = `
📊 財務分析サマリー

総支出: ¥${analysis.totalSpending.toLocaleString()}
最大支出カテゴリ: ${topCategory[0]} (¥${topCategory[1].toLocaleString()})
月平均支出: ¥${currentAvgMonthly.toLocaleString()}
推奨月間貯蓄: ¥${potentialSavings.toLocaleString()}

主な改善提案:
• 最大支出カテゴリ「${topCategory[0]}」の見直し
• 月別予算の設定と追跡
• 定期的な支出パターンの見直し
• 月額¥${potentialSavings.toLocaleString()}の貯蓄目標

分析対象月数: ${analysis.monthlyTrend.length}ヶ月
上位支出先: ${analysis.topMerchants.length}件
      `.trim();

      console.log("✅ Report generated successfully");

      return {
        htmlReport,
        summary,
      };
    } catch (error) {
      console.error("❌ Failed to generate report:", error);
      throw error;
    }
  },
});

// ワークフローの統合
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
  .then(generateReport);

financialAnalysisWorkflow.commit();

export { financialAnalysisWorkflow };
