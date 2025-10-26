# Dependencies and Data Sources

このドキュメントでは、セカイクラベプロジェクトで使用している外部ライブラリ、API、オープンデータについて説明します。

## 外部ライブラリ

### Leaflet.js
- **バージョン**: 1.9.4
- **用途**: インタラクティブな地図の表示とGeoJSONレイヤーのレンダリング
- **ライセンス**: BSD 2-Clause License
- **公式サイト**: https://leafletjs.com/
- **CDN**: https://unpkg.com/leaflet@1.9.4/dist/leaflet.js
- **使用箇所**:
  - index.html (line 7-8): CSS/JSのロード
  - app.js (line 1-8): マップ初期化、タイルレイヤー追加、GeoJSONレンダリング

**主な機能:**
- インタラクティブマップのパン・ズーム
- マーカー配置
- GeoJSONポリゴンの描画
- マップクリックイベントのハンドリング

---

### OpenStreetMap
- **用途**: 地図タイルの提供
- **ライセンス**: Open Database License (ODbL)
- **公式サイト**: https://www.openstreetmap.org/
- **タイルサーバー**: https://tile.openstreetmap.org/{z}/{x}/{y}.png
- **使用箇所**: app.js (line 5-8)

**利用規約:**
- © OpenStreetMap contributors
- データはODbLライセンスの下で利用可能
- アトリビューション表示が必須（アプリ内で表示済み）

**参考リンク:**
- タイル利用ポリシー: https://operations.osmfoundation.org/policies/tiles/
- 著作権とライセンス: https://www.openstreetmap.org/copyright

---

### Nominatim API
- **用途**: 国名・島名のジオコーディングと海岸線GeoJSONデータの取得
- **ライセンス**: データはODbL（OpenStreetMapと同じ）、APIは自由に利用可能
- **公式サイト**: https://nominatim.openstreetmap.org/
- **エンドポイント**: https://nominatim.openstreetmap.org/search
- **使用箇所**: app.js (line 283)

**APIパラメータ:**
- `q`: 検索クエリ（国名・島名）
- `format=json`: JSON形式で結果を取得
- `polygon_geojson=1`: ポリゴンデータをGeoJSON形式で取得
- `limit=5`: 最大5件の結果を取得

**利用規約:**
- リクエスト間隔: 1秒以上（コード内で実装済み: app.js line 16, 272-280）
- User-Agent設定推奨
- 大量アクセスの場合は独自のNominatimサーバー構築を推奨

**参考リンク:**
- 利用規約: https://operations.osmfoundation.org/policies/nominatim/
- APIドキュメント: https://nominatim.org/release-docs/latest/api/Search/

---

### Web Speech API
- **用途**: 音声入力機能（国名・島名の音声認識）
- **ライセンス**: ブラウザ標準API（無料）
- **対応ブラウザ**: Chrome, Edge, Safari
- **公式ドキュメント**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **使用箇所**: voice-input-widget.js (line 134-163)

**主な機能:**
- 日本語音声認識 (`lang: 'ja-JP'`)
- リアルタイム音声テキスト変換
- 連続認識モード

**制限事項:**
- HTTPS接続またはlocalhostでのみ動作
- ブラウザによって実装が異なる
- ネットワーク接続が必要

---

### Leaflet Color Markers
- **用途**: カスタムカラーのマーカーアイコン（赤ピン）
- **ライセンス**: MIT License
- **GitHub**: https://github.com/pointhi/leaflet-color-markers
- **使用箇所**: app.js (line 244-251, 384-395)

**使用アイコン:**
- `marker-icon-2x-red.png`: 赤色のピンマーカー（中心点表示用）

---

## 自作コンポーネント

### VoiceInputWidget
- **ファイル**: voice-input-widget.js, voice-input-widget.css
- **用途**: 音声入力ウィジェット
- **依存関係**: Web Speech API
- **オプション依存**: Kuromoji.js（名詞抽出機能、本プロジェクトでは未使用）

### TutorialWidget
- **ファイル**: tutorial-widget.js, tutorial-widget.css
- **用途**: 初回訪問者向けチュートリアル表示
- **依存関係**: なし（純粋なJavaScript）
- **元プロジェクト**: C:\Users\ddssk\Documents\MotohaSystem\Experiments\20251016_overlappingmapping\tutorial-widget

---

## データソース

### 国境・海岸線データ
- **提供元**: OpenStreetMap / Nominatim
- **ライセンス**: Open Database License (ODbL)
- **データタイプ**: GeoJSON (Polygon / MultiPolygon)
- **取得方法**: Nominatim Search API

**データ内容:**
- 国の行政境界線（administrative boundaries）
- 島の海岸線（coastline）
- MultiPolygon形式で複数の陸地を含む場合あり

**データ処理:**
- 国の場合: 最大面積のポリゴンのみ抽出（本土のみ表示）
- 島の場合: 全てのポリゴンを表示

---

## ライセンス情報まとめ

| コンポーネント | ライセンス | 帰属表示 |
|--------------|----------|---------|
| Leaflet.js | BSD 2-Clause | 必要 |
| OpenStreetMap (タイル) | ODbL | 必要（表示済み） |
| Nominatim API | データ: ODbL, API: 自由利用 | 必要（OSMと同じ） |
| Web Speech API | ブラウザ標準API | 不要 |
| Leaflet Color Markers | MIT | 推奨 |

---

## 帰属表示

アプリケーション内での帰属表示（index.html / app.js line 6）:

```
© OpenStreetMap contributors
```

この表示により、OpenStreetMap、Nominatim、地図タイルデータのライセンス要件を満たしています。

---

## 外部サービスへの依存

### オンライン必須サービス:
1. **OpenStreetMap タイルサーバー**: 地図タイルの読み込み
2. **Nominatim API**: 国名・島名の検索とGeoJSONデータ取得
3. **Leaflet CDN**: Leaflet.js本体とCSSの読み込み
4. **Leaflet Color Markers CDN**: マーカーアイコン画像
5. **Web Speech API**: 音声認識処理（Googleなどのクラウドサービス）

**オフライン動作:**
現在の実装では完全なオフライン動作は不可能です。オフライン対応するには以下が必要:
- 地図タイルのローカルキャッシュ
- GeoJSONデータの事前ダウンロード
- Leaflet.jsのローカルホスティング

---

## バージョン管理とアップデート

### 定期的な確認が推奨される項目:

1. **Leaflet.js**:
   - 現在: 1.9.4
   - 最新版確認: https://leafletjs.com/download.html

2. **Nominatim API**:
   - 利用規約の変更確認
   - エンドポイントの変更確認

3. **OpenStreetMap タイル**:
   - タイルサーバーの利用ポリシー変更

---

## トラブルシューティング

### CDNが利用できない場合

**Leaflet.js:**
```bash
# ローカルにダウンロード
wget https://unpkg.com/leaflet@1.9.4/dist/leaflet.js
wget https://unpkg.com/leaflet@1.9.4/dist/leaflet.css
```

index.htmlを修正:
```html
<link rel="stylesheet" href="./leaflet.css" />
<script src="./leaflet.js"></script>
```

### Nominatim APIが制限される場合

1. **独自Nominatimサーバーの構築**: https://nominatim.org/release-docs/latest/admin/Installation/
2. **代替ジオコーディングサービス**: Mapbox Geocoding API, Google Geocoding API（要APIキー）
3. **ローカルGeoJSONデータ**: 事前にデータをダウンロードして静的ファイルとして配置

---

## 参考リンク

- **Leaflet Documentation**: https://leafletjs.com/reference.html
- **OpenStreetMap Wiki**: https://wiki.openstreetmap.org/
- **Nominatim Documentation**: https://nominatim.org/release-docs/latest/
- **Web Speech API Tutorial**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API
- **ODbL License**: https://opendatacommons.org/licenses/odbl/

---

**最終更新**: 2025年10月26日
