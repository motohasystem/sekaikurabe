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

// 島名を英語に変換
function translateIslandName(islandName) {
    return islandNameMap[islandName] || islandName;
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
async function showIslandCoastline(islandName) {
    try {
        showStatus('海岸線データを読み込み中...');

        // 島名を英語に変換
        const englishIslandName = translateIslandName(islandName);

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

        // まずNominatim APIで島の情報を取得
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(englishIslandName + ' Japan')}&format=json&polygon_geojson=1&limit=1`;

        const nominatimResponse = await fetch(nominatimUrl, {
            headers: {
                'User-Agent': 'JapaneseIslandViewer/1.0'
            }
        });

        if (!nominatimResponse.ok) {
            throw new Error('島データの取得に失敗しました');
        }

        const nominatimData = await nominatimResponse.json();

        if (nominatimData.length === 0) {
            throw new Error('見つかりません');
        }

        const islandData = nominatimData[0];

        if (islandData.geojson) {
            // GeoJSONを現在の地図中心に配置
            const centeredGeojson = centerGeoJSON(islandData.geojson, currentCenter);

            const layer = L.geoJSON(centeredGeojson, {
                style: {
                    color: '#3498db',
                    weight: 2,
                    fillOpacity: 0.1
                }
            }).addTo(map);

            coastlineLayers.push(layer);
            showStatus(`${islandName}の海岸線を表示しました`);
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
    const islandName = document.getElementById('islandInput').value.trim();
    if (islandName) {
        showIslandCoastline(islandName);
    } else {
        showStatus('島名を入力してください', true);
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
showStatus('島名を入力して「表示」ボタンをクリックしてください');
