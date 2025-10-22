// 地図の初期化
const map = L.map('map').setView([36.5, 138], 6);

// OpenStreetMapタイルレイヤーを追加
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// 海岸線レイヤーを保存するための変数
let coastlineLayers = [];
// 中心ピンマーカー
let centerMarker = null;
// 最後のリクエスト時刻（レート制限対策）
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1秒

// ステータス表示用の関数
function showStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
}

// 日本の主要な島の名前マッピング
const islandNameMap = {
    '本州': 'Honshu',
    '北海道': 'Hokkaido',
    '九州': 'Kyushu',
    '四国': 'Shikoku',
    '沖縄本島': 'Okinawa Island',
    '沖縄': 'Okinawa Island',
    '佐渡島': 'Sado Island',
    '佐渡': 'Sado Island',
    '淡路島': 'Awaji Island',
    '淡路': 'Awaji Island',
    '対馬': 'Tsushima',
    '壱岐': 'Iki',
    '種子島': 'Tanegashima',
    '屋久島': 'Yakushima',
    '奄美大島': 'Amami Oshima',
    '石垣島': 'Ishigaki Island',
    '宮古島': 'Miyako Island'
};

// 世界の国名マッピング
const countryNameMap = {
    '日本': 'Japan',
    'アメリカ': 'United States',
    'アメリカ合衆国': 'United States',
    '米国': 'United States',
    'イギリス': 'United Kingdom',
    '英国': 'United Kingdom',
    'フランス': 'France',
    'ドイツ': 'Germany',
    'イタリア': 'Italy',
    'スペイン': 'Spain',
    'カナダ': 'Canada',
    '中国': 'China',
    '韓国': 'South Korea',
    '北朝鮮': 'North Korea',
    'ロシア': 'Russia',
    'オーストラリア': 'Australia',
    'ブラジル': 'Brazil',
    'インド': 'India',
    'メキシコ': 'Mexico',
    'アルゼンチン': 'Argentina',
    'エジプト': 'Egypt',
    '南アフリカ': 'South Africa',
    'タイ': 'Thailand',
    'ベトナム': 'Vietnam',
    'フィリピン': 'Philippines',
    'インドネシア': 'Indonesia',
    'マレーシア': 'Malaysia',
    'シンガポール': 'Singapore',
    'ニュージーランド': 'New Zealand',
    'トルコ': 'Turkey',
    'ギリシャ': 'Greece',
    'ポーランド': 'Poland',
    'オランダ': 'Netherlands',
    'ベルギー': 'Belgium',
    'スイス': 'Switzerland',
    'オーストリア': 'Austria',
    'スウェーデン': 'Sweden',
    'ノルウェー': 'Norway',
    'デンマーク': 'Denmark',
    'フィンランド': 'Finland',
    'ポルトガル': 'Portugal',
    'チェコ': 'Czech Republic',
    'ハンガリー': 'Hungary',
    'ルーマニア': 'Romania',
    'ウクライナ': 'Ukraine',
    'サウジアラビア': 'Saudi Arabia',
    'イラン': 'Iran',
    'イラク': 'Iraq',
    'イスラエル': 'Israel',
    'チリ': 'Chile',
    'ペルー': 'Peru',
    'コロンビア': 'Colombia',
    'ベネズエラ': 'Venezuela',
    'アイスランド': 'Iceland',
    'グリーンランド': 'Greenland',
    'バチカン': 'Vatican City',
    'バチカン市国': 'Vatican City',
    'モナコ': 'Monaco',
    'サンマリノ': 'San Marino',
    'リヒテンシュタイン': 'Liechtenstein',
    'ルクセンブルク': 'Luxembourg',
    'マルタ': 'Malta'
};

// 島名または国名を英語に変換
function translateName(name) {
    // まず島名として検索
    if (islandNameMap[name]) {
        return { english: islandNameMap[name], type: 'island' };
    }
    // 次に国名として検索
    if (countryNameMap[name]) {
        return { english: countryNameMap[name], type: 'country' };
    }
    // 見つからない場合はそのまま返す（英語名の可能性）
    return { english: name, type: 'unknown' };
}

// ポリゴンの面積を計算（簡易的な方法）
function calculatePolygonArea(coordinates) {
    if (!coordinates || coordinates.length === 0) return 0;

    // GeoJSON形式 [lng, lat] の座標配列の場合
    if (typeof coordinates[0][0] === 'number' && typeof coordinates[0][1] === 'number') {
        let area = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            area += (coordinates[i][0] * coordinates[i + 1][1]) - (coordinates[i + 1][0] * coordinates[i][1]);
        }
        return Math.abs(area / 2);
    }

    // ネストされた配列の場合、最初の要素（外側のリング）を使用
    if (Array.isArray(coordinates[0])) {
        return calculatePolygonArea(coordinates[0]);
    }

    return 0;
}

// GeoJSONから最大のポリゴンのみを抽出（メインランド）
function extractMainlandFromGeoJSON(geojson) {
    const newGeojson = JSON.parse(JSON.stringify(geojson));

    if (newGeojson.type === 'Polygon') {
        // 単一ポリゴンの場合はそのまま返す
        return newGeojson;
    } else if (newGeojson.type === 'MultiPolygon') {
        // MultiPolygonの場合、最大のポリゴンを抽出
        let maxArea = 0;
        let mainlandPolygon = null;

        for (const polygon of newGeojson.coordinates) {
            const area = calculatePolygonArea(polygon[0]); // 外側のリングのみ
            if (area > maxArea) {
                maxArea = area;
                mainlandPolygon = polygon;
            }
        }

        // Polygonタイプとして返す
        return {
            type: 'Polygon',
            coordinates: mainlandPolygon
        };
    }

    return newGeojson;
}

// GeoJSONの中心座標を計算
function calculateGeoJSONCenter(geojson) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    function processCoordinates(coords) {
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            // [lng, lat]形式の座標点
            minLng = Math.min(minLng, coords[0]);
            maxLng = Math.max(maxLng, coords[0]);
            minLat = Math.min(minLat, coords[1]);
            maxLat = Math.max(maxLat, coords[1]);
        } else if (Array.isArray(coords)) {
            // ネストされた配列
            coords.forEach(c => processCoordinates(c));
        }
    }

    if (geojson.type === 'Polygon') {
        processCoordinates(geojson.coordinates);
    } else if (geojson.type === 'MultiPolygon') {
        geojson.coordinates.forEach(polygon => processCoordinates(polygon));
    }

    return {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2
    };
}

// GeoJSONを指定した中心に移動
function centerGeoJSON(geojson, targetCenter) {
    const currentCenter = calculateGeoJSONCenter(geojson);
    const offsetLat = targetCenter.lat - currentCenter.lat;
    const offsetLng = targetCenter.lng - currentCenter.lng;

    const newGeojson = JSON.parse(JSON.stringify(geojson));

    function shiftCoordinates(coords) {
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            // [lng, lat]形式の座標点
            return [coords[0] + offsetLng, coords[1] + offsetLat];
        } else if (Array.isArray(coords)) {
            // ネストされた配列
            return coords.map(c => shiftCoordinates(c));
        }
        return coords;
    }

    if (newGeojson.type === 'Polygon') {
        newGeojson.coordinates = shiftCoordinates(newGeojson.coordinates);
    } else if (newGeojson.type === 'MultiPolygon') {
        newGeojson.coordinates = newGeojson.coordinates.map(polygon => shiftCoordinates(polygon));
    }

    return newGeojson;
}

// 海岸線データを取得して表示する関数
async function showCoastline(inputName) {
    try {
        showStatus('海岸線データを読み込み中...');

        // 名前を英語に変換し、タイプを判定
        const translated = translateName(inputName);
        const englishName = translated.english;
        const type = translated.type;

        // 中心座標を決定（ピンがあればピンの位置、なければ地図の中心）
        let currentCenter;
        if (centerMarker) {
            // 既存のピンがある場合、その位置を中心として使用
            currentCenter = centerMarker.getLatLng();
            console.log(`ピンの位置を中心に使用: lat=${currentCenter.lat}, lng=${currentCenter.lng}`);
        } else {
            // ピンがない場合、地図の中心を使用してピンを作成
            currentCenter = map.getCenter();
            centerMarker = L.marker([currentCenter.lat, currentCenter.lng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map);
            centerMarker.bindPopup('中心点').openPopup();
            console.log(`新しいピンを作成: lat=${currentCenter.lat}, lng=${currentCenter.lng}`);
        }

        // 検索クエリを構築
        let searchQuery = englishName;
        let searchParams = `q=${encodeURIComponent(searchQuery)}&format=json&polygon_geojson=1`;

        if (type === 'island') {
            // 島の場合はJapanを追加
            searchQuery = `${englishName} Japan`;
            searchParams = `q=${encodeURIComponent(searchQuery)}&format=json&polygon_geojson=1&limit=5`;
        } else if (type === 'country') {
            // 国の場合は国レベルの結果を優先（複数取得してフィルタリング）
            searchParams = `q=${encodeURIComponent(searchQuery)}&format=json&polygon_geojson=1&limit=5`;
        } else {
            searchParams = `q=${encodeURIComponent(searchQuery)}&format=json&polygon_geojson=1&limit=5`;
        }

        // レート制限対策: 前回のリクエストから一定時間待機
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
            showStatus(`リクエスト制限のため${Math.ceil(waitTime / 1000)}秒待機中...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        lastRequestTime = Date.now();

        // Nominatim APIでデータを取得
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?${searchParams}`;

        showStatus('データを読み込み中...');
        const nominatimResponse = await fetch(nominatimUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!nominatimResponse.ok) {
            if (nominatimResponse.status === 403) {
                throw new Error('アクセスが制限されています。しばらく待ってから再度お試しください');
            }
            throw new Error(`データの取得に失敗しました (${nominatimResponse.status})`);
        }

        const nominatimData = await nominatimResponse.json();

        if (nominatimData.length === 0) {
            throw new Error('見つかりません');
        }

        // デバッグ: APIレスポンスを確認
        console.log('=== Nominatim API Response ===');
        console.log(`検索: ${inputName} (${englishName})`);
        console.log(`結果数: ${nominatimData.length}`);
        nominatimData.forEach((item, index) => {
            console.log(`結果${index + 1}: ${item.display_name}`);
            console.log(`  - type: ${item.type}, class: ${item.class}, place_rank: ${item.place_rank}`);
            console.log(`  - geojson type: ${item.geojson ? item.geojson.type : 'なし'}`);
        });

        // 適切な結果を選択（国や島レベルの結果を優先）
        let data = nominatimData[0];

        if (type === 'country') {
            // 国の場合、typeが'administrative'で、かつplace_rankが低い（=より広域）ものを優先
            const countryResult = nominatimData.find(item =>
                (item.type === 'administrative' && item.place_rank <= 8) ||
                item.type === 'country' ||
                item.class === 'boundary' && item.type === 'administrative'
            );
            if (countryResult) {
                data = countryResult;
                console.log(`国レベルの結果を選択: ${data.display_name}`);
            }
        } else if (type === 'island') {
            // 島の場合、typeが'island'のものを優先
            const islandResult = nominatimData.find(item => item.type === 'island');
            if (islandResult) {
                data = islandResult;
                console.log(`島の結果を選択: ${data.display_name}`);
            }
        }

        console.log('=== 選択されたデータ ===');
        console.log(`display_name: ${data.display_name}`);
        console.log(`geojson: ${data.geojson ? 'あり' : 'なし'}`);
        if (data.geojson) {
            console.log(`geojson type: ${data.geojson.type}`);
            console.log('geojson:', data.geojson);
        }

        if (data.geojson) {
            // 国の場合はメインランドのみを抽出
            let processedGeojson = data.geojson;
            if (type === 'country' || type === 'unknown') {
                processedGeojson = extractMainlandFromGeoJSON(data.geojson);
                console.log('=== メインランド抽出後 ===');
                console.log(`type: ${processedGeojson.type}`);
                console.log('processedGeojson:', processedGeojson);
            }

            // 座標点数をカウント
            let coordCount = 0;
            if (processedGeojson.type === 'Polygon') {
                coordCount = processedGeojson.coordinates[0].length;
            } else if (processedGeojson.type === 'MultiPolygon') {
                processedGeojson.coordinates.forEach(polygon => {
                    coordCount += polygon[0].length;
                });
            }
            console.log(`座標点数: ${coordCount}`);

            // GeoJSONを現在の地図中心に配置
            const centeredGeojson = centerGeoJSON(processedGeojson, currentCenter);
            console.log('=== 座標変換後 ===');
            console.log('centeredGeojson:', centeredGeojson);

            // バウンディングボックスを計算
            const bounds = calculateGeoJSONCenter(centeredGeojson);
            console.log(`中心座標: lat=${bounds.lat}, lng=${bounds.lng}`);

            const layer = L.geoJSON(centeredGeojson, {
                style: {
                    color: '#3498db',
                    weight: 2,
                    fillOpacity: 0.1
                }
            }).addTo(map);

            coastlineLayers.push(layer);
            console.log('地図にレイヤーを追加しました');
            const displayMode = (type === 'country' || type === 'unknown') ? '（メインランドのみ）' : '';
            showStatus(`${inputName}の海岸線を表示しました${displayMode}`);
            return;
        }

        throw new Error('見つかりません');

    } catch (error) {
        showStatus(`エラー: ${error.message}`, true);
        console.error('Error:', error);
    }
}

// すべての海岸線レイヤーをクリアする関数
function clearCoastlines() {
    coastlineLayers.forEach(layer => {
        map.removeLayer(layer);
    });
    coastlineLayers = [];

    // 中心ピンも削除
    if (centerMarker) {
        map.removeLayer(centerMarker);
        centerMarker = null;
    }

    showStatus('表示をクリアしました');
}

// 現在地に移動する関数
function goToCurrentLocation() {
    if (!navigator.geolocation) {
        showStatus('お使いのブラウザは位置情報に対応していません', true);
        return;
    }

    showStatus('現在地を取得中...');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // 現在地にマーカーを追加
            const marker = L.marker([lat, lon]).addTo(map);
            marker.bindPopup('現在地').openPopup();

            // 現在地にズーム
            map.setView([lat, lon], 13);

            showStatus('現在地に移動しました');
        },
        (error) => {
            let errorMessage = '位置情報の取得に失敗しました';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = '位置情報の使用が許可されていません';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = '位置情報が利用できません';
                    break;
                case error.TIMEOUT:
                    errorMessage = '位置情報の取得がタイムアウトしました';
                    break;
            }
            showStatus(errorMessage, true);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// 地図上でのピン配置機能
function placePin(lat, lng) {
    // 既存のピンがあれば削除
    if (centerMarker) {
        map.removeLayer(centerMarker);
    }

    // 新しいピンを作成
    centerMarker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);

    centerMarker.bindPopup('中心点').openPopup();
    showStatus('ピンを配置しました。国名/島名を入力して表示してください');
}

// 地図クリックイベント
map.on('click', (e) => {
    placePin(e.latlng.lat, e.latlng.lng);
});

// イベントリスナーの設定
document.getElementById('showBtn').addEventListener('click', () => {
    const inputName = document.getElementById('islandInput').value.trim();
    if (inputName) {
        showCoastline(inputName);
    } else {
        showStatus('国名または島名を入力してください', true);
    }
});

document.getElementById('clearBtn').addEventListener('click', () => {
    clearCoastlines();
    document.getElementById('islandInput').value = '';
});

document.getElementById('locationBtn').addEventListener('click', () => {
    goToCurrentLocation();
});

// Enterキーで検索
document.getElementById('islandInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('showBtn').click();
    }
});

// 初期メッセージ
showStatus('国名または島名を入力して「表示」ボタンをクリックしてください');

// 音声入力ウィジェットの初期化
const voiceWidget = new VoiceInputWidget({
    targetIds: ['islandInput'],
    maxLength: 50,
    extractNoun: false, // 国名/島名は短いので名詞抽出は不要
    triggerText: '🎤',
    activeText: '🎙️',
    position: 'fixed',
    onWordExtracted: (word) => {
        // 音声入力後、自動的に表示ボタンをクリック
        setTimeout(() => {
            document.getElementById('showBtn').click();
        }, 100);
    }
});
