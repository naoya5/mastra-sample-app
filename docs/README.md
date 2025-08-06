# MASTRAワークフロー実践ガイド

このプロジェクトは、MASTRAフレームワークを使用した実用的なワークフローの実装例を提供します。実際のビジネスシーンで活用できる3つのワークフローと、詳細な解説ドキュメントが含まれています。

## 📋 含まれるワークフロー

### 1. 🌤️ 天気予報ワークフロー

- **機能**: 都市名から天気予報を取得し、AIがアクティビティを提案
- **ファイル**: `src/mastra/workflows/weather-workflow.ts`
- **実行**: `npm run sample:weather`

### 2. 💰 金融分析ワークフロー

- **機能**: 取引データの分析、支出パターン分析、予算提案、HTMLレポート生成
- **ファイル**: `src/mastra/workflows/financial-analysis-workflow.ts`
- **実行**: `npm run sample:financial`

### 3. 📋 タスク管理ワークフロー

- **機能**: タスクのAI優先順位付け、効率的なスケジュール作成
- **ファイル**: `src/mastra/workflows/task-management-workflow.ts`
- **実行**: `npm run sample:tasks`

## 📚 ドキュメント

### [weather-workflow-guide.md](weather-workflow-guide.md)

- 基本的なMASTRAワークフローの作り方
- Weather Workflowの詳細解説
- ステップ、エージェント、ツールの実装方法

### [workflow-examples-guide.md](workflow-examples-guide.md)

- 3つの実用的なワークフローの完全な実装例
- 金融分析、タスク管理、コンテンツ作成のワークフロー
- ベストプラクティスとエラーハンドリング

### [workflow-usage-examples.md](workflow-usage-examples.md)

- 実際の使用方法とサンプルデータ
- 各ワークフローの入力例と期待される出力
- トラブルシューティングガイド

## 🚀 クイックスタート

### 1. 環境設定

```bash
# 依存関係のインストール
npm install

# OpenAI APIキーの設定（必須）
export OPENAI_API_KEY="your-api-key-here"
```

### 2. ワークフローの実行

```bash
# 天気予報ワークフロー
npm run sample:weather

# 金融分析ワークフロー（HTMLレポート付き）
npm run sample:financial

# タスク管理ワークフロー
npm run sample:tasks

# ヘルプの表示
npm run sample:help
```

### 3. 開発サーバーの起動

```bash
# MASTRAの開発サーバー起動
npm run dev

# REST API経由でのアクセスが可能
# POST http://localhost:3000/workflows/weather-workflow/execute
# POST http://localhost:3000/workflows/financial-analysis-workflow/execute
# POST http://localhost:3000/workflows/task-management-workflow/execute
```

## 🏗️ プロジェクト構成

```
mastra-sample-app/
├── docs/                                    # ドキュメント
│   ├── README.md                           # このファイル
│   ├── weather-workflow-guide.md           # 基本ガイド
│   ├── workflow-examples-guide.md          # 実装例ガイド
│   └── workflow-usage-examples.md          # 使用例ガイド
├── scripts/
│   └── sample-workflows.js                 # サンプル実行スクリプト
└── src/mastra/
    ├── index.ts                            # MASTRA設定
    ├── workflows/
    │   ├── weather-workflow.ts             # 天気予報ワークフロー
    │   ├── financial-analysis-workflow.ts  # 金融分析ワークフロー
    │   └── task-management-workflow.ts     # タスク管理ワークフロー
    ├── agents/
    │   ├── weather-agent.ts                # 天気予報エージェント
    │   └── financial-agent.ts              # 金融エージェント
    └── tools/
        ├── weather-tool.ts                  # 天気ツール
        └── get-transactions-tool.ts         # 取引データツール
```

## 💡 学習ポイント

このプロジェクトから学べる主要な概念：

### 1. ワークフロー設計

- **マルチステップ処理**: データ取得 → 分析 → AI処理 → レポート生成
- **スキーマ駆動開発**: Zodを使用した型安全な入出力定義
- **エラーハンドリング**: 堅牢なエラー処理とリトライ戦略

### 2. AIエージェントの活用

- **専門性のあるエージェント**: 金融、天気、タスク管理の専門エージェント
- **ツールの統合**: エージェントが外部ツールを使用する方法
- **メモリの活用**: 会話履歴の保持と活用

### 3. 実用的なパターン

- **データ変換パイプライン**: CSV解析、データ集計、レポート生成
- **AI支援の意思決定**: タスクの優先順位付け、スケジュール最適化
- **ユーザビリティ**: わかりやすい出力とHTML レポート生成

## 🛠️ カスタマイズ方法

### 新しいワークフローの追加

1. **ワークフローファイルの作成**

```typescript
// src/mastra/workflows/my-workflow.ts
import { createWorkflow, createStep } from "@mastra/core/workflows";

const myWorkflow = createWorkflow({
  id: "my-workflow",
  // ...
});
```

2. **MASTRA設定への追加**

```typescript
// src/mastra/index.ts
import { myWorkflow } from "./workflows/my-workflow";

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    financialAnalysisWorkflow,
    taskManagementWorkflow,
    myWorkflow, // 新しいワークフローを追加
  },
  // ...
});
```

3. **サンプルスクリプトへの追加**

```javascript
// scripts/sample-workflows.js
case 'my-workflow':
  await runMyWorkflow();
  break;
```

### エージェントのカスタマイズ

```typescript
// 新しいエージェントの作成
const customAgent = new Agent({
  name: "Custom Agent",
  instructions: "カスタム指示...",
  model: openai("gpt-4"),
  tools: { customTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:./custom.db",
    }),
  }),
});
```

## 🔧 技術仕様

### 依存関係

- **MASTRA Core**: ワークフロー、エージェント、ツールの基盤
- **OpenAI**: AI モデルとの統合
- **Zod**: スキーマ検証とTypeScript型生成
- **LibSQL**: データストレージ

### 対応環境

- Node.js 20.9.0+
- TypeScript 5.8+
- ES Modules

### API仕様

- REST API: 自動生成されるMASTRA API
- WebSocket: リアルタイム通信（開発サーバーのみ）
- JSON Schema: 全ての入出力は型安全

## 🤝 コントリビューション

1. 新しいワークフローの提案
2. ドキュメントの改善
3. バグレポートと機能要求
4. パフォーマンス最適化

## 📄 ライセンス

このプロジェクトはサンプル用途のために作成されています。実際のプロダクションでの使用前に、各依存関係のライセンスを確認してください。

## 🆘 サポート

- **ドキュメント**: `docs/` フォルダ内の各ガイドを参照
- **サンプル実行**: `npm run sample:help` でヘルプを表示
- **トラブルシューティング**: `docs/workflow-usage-examples.md` の該当セクションを参照

---

🎉 **Happy Coding with MASTRA!**

このプロジェクトを通じて、MASTRAフレームワークの強力な機能と、実用的なAIワークフローの構築方法を学んでください。
