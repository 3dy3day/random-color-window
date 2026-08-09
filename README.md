# Random Color Window

VS Code のワークスペースごとに、16色のプリセットから識別色を自動で割り当てます。
複数のAI開発ウィンドウを並べたとき、どの作業かを色で見分けられます。

VS Code API ではOSウィンドウへ独自の太い枠を描けないため、公開されている
`window.activeBorder` / `window.inactiveBorder` に加えて、タイトルバー、
アクティビティバー(左のアイコンバー)全体、ステータスバー(下のバー)、
リモートインジケーターを同色に塗ります。選んだ色は `.vscode/settings.json` に
保存されるため、同じプロジェクトを開き直しても維持されます。
拡張機能の更新で塗る範囲が増えた場合は、起動時に自動で再適用されます。

## Commands

- `Random Color Window: Change Window Color` — 16色から選択
- `Random Color Window: Pick a New Random Color` — 別の色をランダム選択
- `Random Color Window: Reset Window Color` — 拡張機能が設定した色を削除

## 開発

```sh
npm install
npm run compile
```

VS Codeでこのフォルダーを開き、`F5` で Extension Development Host を起動します。
