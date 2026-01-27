# YoutubeLive DiscordBot

YouTubeのライブ配信/予定を監視し、Discord WebhookへEmbed形式で通知する常駐型のNode.js Botです。

## 特徴
- 監視対象チャンネルの配信予定/配信開始/配信終了を検知
- 取得タイミングで新規または差分がある場合のみ通知
- 差分判定はタイトル/URL/サムネ/開始時刻のみ
- 通知種別ごとのEmbed色指定
- すべてのログを `latest.log` へ集約

## 必要環境
- Node.js 18 以上

## セットアップ
1. 依存関係のインストール
```
npm install
```

2. 設定ファイルの用意
`sample_config.json` を `config.json` にコピーして編集します。
`CONFIG_DIR` で指定したディレクトリに配置してください。

3. 環境変数の用意
`sample.env` を `.env` にコピーして編集します。

```
CONFIG_DIR=./config
LOG_DIR=./logs
YOUTUBE_API_KEY=your_youtube_api_key
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

## 起動
```
npm start
```

## 設定項目
`config.json` の主な項目:
- `poll_interval_minutes`: 取得間隔（分）
- `max_results`: 取得件数（各イベント種別ごと）
- `channels`: 監視対象チャンネル
- `notification`: 通知テンプレート設定
  - `types`: 通知種別
  - `embed.colors`: 通知種別ごとの色
  - `embed.fields`: Embedに含める項目

## ログ
- すべてのログは `LOG_DIR/latest.log` に出力されます。

## 状態保存
- 取得済みデータは `CONFIG_DIR/state.json` に保存されます。

## 注意点
- YouTube Data API を使用します。APIキーが必要です。
- Webhook URL はDiscordのチャンネル設定から取得してください。
