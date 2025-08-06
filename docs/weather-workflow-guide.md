# Weather Workflow Guide - MASTRAワークフローの作り方

このドキュメントでは、MASTRAフレームワークを使用したWeather Workflowの実装例を通じて、MASTRAワークフローの基本的な作り方を解説します。

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [MASTRAの基本概念](#mastraの基本概念)
3. [プロジェクト構成](#プロジェクト構成)
4. [ワークフローの詳細解説](#ワークフローの詳細解説)
5. [エージェントとツールの実装](#エージェントとツールの実装)
6. [実行方法](#実行方法)
7. [カスタマイズ方法](#カスタマイズ方法)

## プロジェクト概要

このサンプルアプリケーションは、指定された都市の天気予報を取得し、その天気情報に基づいて最適なアクティビティを提案するワークフローを実装しています。

### 主な機能

- 都市名から地理座標を取得
- Open-Meteo APIを使用した天気予報の取得
- AI エージェントによるアクティビティ提案
- 構造化されたワークフロー実行

## MASTRAの基本概念

MASTRAは、AI アプリケーションを構築するためのフレームワークで、以下の主要コンポーネントから構成されています：

### 1. ワークフロー (Workflows)

複数のステップを順序立てて実行する処理の流れを定義します。

### 2. エージェント (Agents)

特定のタスクを実行するAI アシスタントです。言語モデル、指示、ツール、メモリを組み合わせて構成されます。

### 3. ツール (Tools)

エージェントが使用できる外部機能です（API呼び出し、データベースアクセスなど）。

### 4. ステップ (Steps)

ワークフローの個々の処理単位です。入力スキーマ、出力スキーマ、実行ロジックを定義します。

## プロジェクト構成

```
src/mastra/
├── index.ts                    # MASTRAの設定とコンポーネント登録
├── workflows/
│   └── weather-workflow.ts     # 天気予報ワークフローの定義
├── agents/
│   ├── weather-agent.ts        # 天気予報エージェント
│   └── financial-agent.ts      # 金融エージェント
└── tools/
    ├── weather-tool.ts          # 天気取得ツール
    └── get-transactions-tool.ts # 取引データ取得ツール
```

## ワークフローの詳細解説

### 1. ワークフローの基本構造

```typescript
const weatherWorkflow = createWorkflow({
  id: "weather-workflow",
  inputSchema: z.object({
    city: z.string().describe("The city to get the weather for"),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather) // ステップ1: 天気予報取得
  .then(planActivities); // ステップ2: アクティビティ提案
```

### 2. ステップ1: 天気予報取得 (`fetchWeather`)

```typescript
const fetchWeather = createStep({
  id: "fetch-weather",
  description: "Fetches weather forecast for a given city",
  inputSchema: z.object({
    city: z.string().describe("The city to get the weather for"),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    // 実装ロジック
  },
});
```

#### 処理フロー：

1. **地理座標の取得**

   ```typescript
   const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
   ```

2. **天気データの取得**

   ```typescript
   const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
   ```

3. **データの整形**
   ```typescript
   const forecast = {
     date: new Date().toISOString(),
     maxTemp: Math.max(...data.hourly.temperature_2m),
     minTemp: Math.min(...data.hourly.temperature_2m),
     condition: getWeatherCondition(data.current.weathercode),
     precipitationChance: data.hourly.precipitation_probability.reduce(
       (acc, curr) => Math.max(acc, curr),
       0
     ),
     location: name,
   };
   ```

### 3. ステップ2: アクティビティ提案 (`planActivities`)

```typescript
const planActivities = createStep({
  id: "plan-activities",
  description: "Suggests activities based on weather conditions",
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    // AIエージェントを使用したアクティビティ提案
  },
});
```

#### 特徴：

- **MASTRAエージェントの使用**: `mastra?.getAgent('weatherAgent')`
- **構造化されたプロンプト**: 詳細なフォーマット指定
- **ストリーミング応答**: リアルタイムでの応答生成

## エージェントとツールの実装

### Weather Agent の設定

```typescript
export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: `
    You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.
  `,
  model: openai("gpt-4o-mini"),
  tools: { weatherTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db",
    }),
  }),
});
```

### Weather Tool の実装

```typescript
export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});
```

### MASTRA設定の統合

```typescript
export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, financialAgent },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
```

## 実行方法

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

### 3. ワークフローの実行

```bash
npm run start
```

## カスタマイズ方法

### 1. 新しいステップの追加

```typescript
const newStep = createStep({
  id: "new-step",
  description: "Description of the new step",
  inputSchema: z.object({
    // 入力スキーマ
  }),
  outputSchema: z.object({
    // 出力スキーマ
  }),
  execute: async ({ inputData }) => {
    // 実行ロジック
  },
});

// ワークフローに追加
const extendedWorkflow = weatherWorkflow.then(newStep);
```

### 2. 新しいツールの作成

```typescript
export const customTool = createTool({
  id: "custom-tool",
  description: "Custom tool description",
  inputSchema: z.object({
    // 入力パラメータ
  }),
  outputSchema: z.object({
    // 出力パラメータ
  }),
  execute: async ({ context }) => {
    // ツールの実装
  },
});
```

### 3. エージェントの設定変更

```typescript
export const customAgent = new Agent({
  name: "Custom Agent",
  instructions: "カスタム指示",
  model: openai("gpt-4"), // モデルの変更
  tools: { customTool }, // ツールの追加
  memory: new Memory({
    // メモリ設定
    storage: new LibSQLStore({
      url: "file:./custom.db",
    }),
  }),
});
```

## まとめ

このWeather Workflowの例を通じて、以下のMASTRAの重要な概念を学習できます：

1. **ワークフローの構造化**: ステップの連携による複雑な処理の実現
2. **スキーマ駆動開発**: Zodを使用した型安全な入出力定義
3. **エージェントとツールの統合**: AIとツールの協調動作
4. **エラーハンドリング**: 適切な例外処理の実装
5. **データフロー**: ステップ間のデータ受け渡し

MASTRAフレームワークを使用することで、複雑なAIワークフローを構造化され、保守しやすい形で実装できます。
