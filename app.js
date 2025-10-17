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
    'グリーンランド': 'Greenland'
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

        // 現在の地図の中心座標を保存
        const currentCenter = map.getCenter();

        // 中心にピンマーカーを追加（既存のピンがあれば削除）
        if (centerMarker) {
            map.removeLayer(centerMarker);
        }
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

        // 検索クエリを構築（島の場合はJapanを追加）
        let searchQuery = englishName;
        if (type === 'island') {
            searchQuery = `${englishName} Japan`;
        }

        // Nominatim APIでデータを取得
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&polygon_geojson=1&limit=1`;

        const nominatimResponse = await fetch(nominatimUrl, {
            headers: {
                'User-Agent': 'CoastlineViewer/1.0'
            }
        });

        if (!nominatimResponse.ok) {
            throw new Error('データの取得に失敗しました');
        }

        const nominatimData = await nominatimResponse.json();

        if (nominatimData.length === 0) {
            throw new Error('見つかりません');
        }

        const data = nominatimData[0];

        if (data.geojson) {
            // 国の場合はメインランドのみを抽出
            let processedGeojson = data.geojson;
            if (type === 'country' || type === 'unknown') {
                processedGeojson = extractMainlandFromGeoJSON(data.geojson);
            }

            // GeoJSONを現在の地図中心に配置
            const centeredGeojson = centerGeoJSON(processedGeojson, currentCenter);

            const layer = L.geoJSON(centeredGeojson, {
                style: {
                    color: '#3498db',
                    weight: 2,
                    fillOpacity: 0.1
                }
            }).addTo(map);

            coastlineLayers.push(layer);
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
