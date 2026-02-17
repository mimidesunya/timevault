# ⏳ Timevault (タイムボルト)

未来の指定した時間まで「絶対に開けられない」タイムカプセルを作成するツールです。
Drand (Distributed Randomness Beacon) の技術を利用し、サーバーに依存せずに暗号化を行います。

## ✨ 主な機能

1.  **時限暗号化**: 復号できる日時を指定してファイルを暗号化します。指定した時刻になるまで、数学的に復号が不可能です。
2.  **共有リンク生成**: 暗号化したファイルをサーバーにアップロードし、共有用URLを発行します。
3.  **セキュアなダウンロード**: 指定時刻を過ぎるまで、サーバーからのダウンロードも制限されます。
4.  **大容量対応**: 最大100MBまでのファイルの暗号化と共有に対応しています。

## 🚀 使い方

### 開発環境のセットアップ

必要な依存関係をインストールし、開発サーバーを起動します。

```bash
npm install
npm start
```
ブラウザで `http://localhost:1234` にアクセスして確認できます。

### 本番環境へのデプロイ

Docker Compose を使用してデプロイします。
以下のコマンドで、リモートサーバーへのデプロイとコンテナの起動が行われます。

```bash
./deploy.sh
```
※ `deploy.json` にデプロイ先の設定が必要です。

## 🛠 技術スタック

-   **Frontend**: Preact, TypeScript, tlock-js
-   **Backend**: Node.js (Express), Multer
-   **Infrastructure**: Docker, Nginx
-   **Time Release Cryptography**: Drand (Quicknet)

## 📜 ライセンス

このプロジェクトは [Apache 2.0](LICENSE-APACHE) および [MIT](LICENSE-MIT) のデュアルライセンスです。
