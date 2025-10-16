// 地図の初期化
const map = L.map('map').setView([35.6762, 139.6503], 5);

// OpenStreetMapタイルレイヤーを追加
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// 国境レイヤーを保存するための変数
let countryLayers = [];
// 中心ピンマーカー
let centerMarker = null;

// ステータス表示用の関数
function showStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
}

// 座標のバウンディングボックスを計算
function getBoundsFromCoordinates(coordinates) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    function processCoords(coords) {
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            // 座標配列の場合
            coords.forEach(coord => {
                const lat = coord[0];
                const lng = coord[1];
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
            });
        } else {
            // ネストされた配列の場合
            coords.forEach(c => processCoords(c));
        }
    }

    processCoords(coordinates);
    return { minLat, maxLat, minLng, maxLng };
}

// バウンディングボックスを地図中心に移動
function centerShapeOnMap(bounds, targetCenter) {
    const latMin = bounds[0][0];
    const lngMin = bounds[0][1];
    const latMax = bounds[1][0];
    const lngMax = bounds[1][1];

    const currentCenterLat = (latMin + latMax) / 2;
    const currentCenterLng = (lngMin + lngMax) / 2;

    const offsetLat = targetCenter.lat - currentCenterLat;
    const offsetLng = targetCenter.lng - currentCenterLng;

    return [
        [latMin + offsetLat, lngMin + offsetLng],
        [latMax + offsetLat, lngMax + offsetLng]
    ];
}

// ポリゴン座標を地図中心に移動
function centerPolygonOnMap(coordinates, targetCenter) {
    const bounds = getBoundsFromCoordinates(coordinates);
    const currentCenterLat = (bounds.minLat + bounds.maxLat) / 2;
    const currentCenterLng = (bounds.minLng + bounds.maxLng) / 2;

    const offsetLat = targetCenter.lat - currentCenterLat;
    const offsetLng = targetCenter.lng - currentCenterLng;

    function shiftCoords(coords) {
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            return coords.map(coord => [coord[0] + offsetLat, coord[1] + offsetLng]);
        } else {
            return coords.map(c => shiftCoords(c));
        }
    }

    return shiftCoords(coordinates);
}

// GeoJSONを地図中心に移動
function centerGeoJSONOnMap(geojson, targetCenter) {
    const newGeojson = JSON.parse(JSON.stringify(geojson));

    function getBounds(coords, type) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;

        function process(c) {
            if (type === 'Polygon' || type === 'MultiPolygon') {
                if (Array.isArray(c[0])) {
                    c.forEach(p => process(p));
                } else {
                    minLng = Math.min(minLng, c[0]);
                    minLat = Math.min(minLat, c[1]);
                    maxLng = Math.max(maxLng, c[0]);
                    maxLat = Math.max(maxLat, c[1]);
                }
            }
        }

        process(coords);
        return { minLat, maxLat, minLng, maxLng };
    }

    function shiftCoordinates(coords, offsetLng, offsetLat, type) {
        if (type === 'Polygon') {
            return coords.map(ring =>
                ring.map(coord => [coord[0] + offsetLng, coord[1] + offsetLat])
            );
        } else if (type === 'MultiPolygon') {
            return coords.map(polygon =>
                polygon.map(ring =>
                    ring.map(coord => [coord[0] + offsetLng, coord[1] + offsetLat])
                )
            );
        }
        return coords;
    }

    const bounds = getBounds(newGeojson.coordinates, newGeojson.type);
    const currentCenterLat = (bounds.minLat + bounds.maxLat) / 2;
    const currentCenterLng = (bounds.minLng + bounds.maxLng) / 2;

    const offsetLat = targetCenter.lat - currentCenterLat;
    const offsetLng = targetCenter.lng - currentCenterLng;

    newGeojson.coordinates = shiftCoordinates(
        newGeojson.coordinates,
        offsetLng,
        offsetLat,
        newGeojson.type
    );

    return newGeojson;
}

// 日本語の国名を英語に変換
function translateCountryName(countryName) {
    const countryMap = {
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
        'ベネズエラ': 'Venezuela'
    };

    return countryMap[countryName] || countryName;
}

// ポリゴンの面積を計算（簡易的な方法）
function calculatePolygonArea(coordinates) {
    if (!coordinates || coordinates.length === 0) return 0;

    // 座標配列の場合
    if (typeof coordinates[0][0] === 'number') {
        let area = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            area += (coordinates[i][1] * coordinates[i + 1][0]) - (coordinates[i + 1][1] * coordinates[i][0]);
        }
        return Math.abs(area / 2);
    }

    // ネストされた配列の場合、最初の要素を使用
    return calculatePolygonArea(coordinates[0]);
}

// 最大のポリゴンのみを抽出（メインランド）
function extractMainland(coordinates) {
    if (!coordinates || coordinates.length === 0) return coordinates;

    // 各ポリゴンの面積を計算
    let maxArea = 0;
    let mainlandIndex = 0;

    for (let i = 0; i < coordinates.length; i++) {
        const area = calculatePolygonArea(coordinates[i]);
        if (area > maxArea) {
            maxArea = area;
            mainlandIndex = i;
        }
    }

    // 最大面積のポリゴンのみを返す
    return [coordinates[mainlandIndex]];
}

// GeoJSONから最大のポリゴンのみを抽出
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

        // PolygonタイプとSして返す
        return {
            type: 'Polygon',
            coordinates: mainlandPolygon
        };
    }

    return newGeojson;
}

// 国境データを取得して表示する関数
async function showCountryBorder(countryName) {
    try {
        showStatus('データを読み込み中...');

        // 日本語の国名を英語に変換
        const englishCountryName = translateCountryName(countryName);

        // チェックボックスの状態を取得
        const landOnly = document.getElementById('landOnlyCheckbox').checked;

        // 現在の地図の中心座標とズームレベルを保存
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();

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

        // Nominatim APIで国名から情報を取得
        const searchUrl = `https://nominatim.openstreetmap.org/search?country=${encodeURIComponent(englishCountryName)}&format=json&polygon_geojson=1&limit=1`;

        const searchResponse = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'CountryBorderMap/1.0'
            }
        });

        if (!searchResponse.ok) {
            throw new Error('国データの取得に失敗しました');
        }

        const searchData = await searchResponse.json();

        if (searchData.length === 0) {
            throw new Error('指定された国が見つかりません');
        }

        const countryData = searchData[0];

        // GeoJSONがない場合、overpass APIを使用
        let geojson;
        if (countryData.geojson) {
            geojson = countryData.geojson;
        } else {
            // Overpass APIで詳細な国境データを取得
            const overpassUrl = 'https://overpass-api.de/api/interpreter';
            const query = `
                [out:json];
                area["name:en"="${englishCountryName}"]->.a;
                (
                  relation(area.a)["admin_level"="2"]["boundary"="administrative"];
                );
                out geom;
            `;

            const overpassResponse = await fetch(overpassUrl, {
                method: 'POST',
                body: query
            });

            if (!overpassResponse.ok) {
                throw new Error('詳細な国境データの取得に失敗しました');
            }

            const overpassData = await overpassResponse.json();

            if (overpassData.elements.length === 0) {
                // Nominatimのbounding boxを使用
                if (countryData.boundingbox) {
                    const bbox = countryData.boundingbox;
                    const bounds = [
                        [parseFloat(bbox[0]), parseFloat(bbox[2])],
                        [parseFloat(bbox[1]), parseFloat(bbox[3])]
                    ];

                    // 国の形を現在の地図中心に配置
                    const centeredBounds = centerShapeOnMap(bounds, currentCenter);

                    const rectangle = L.rectangle(centeredBounds, {
                        color: '#3498db',
                        weight: 3,
                        fillOpacity: 0.2
                    }).addTo(map);

                    countryLayers.push(rectangle);
                    showStatus(`${countryName}の範囲を表示しました（簡易表示）`);
                    return;
                }
                throw new Error('国境データが見つかりません');
            }

            // Overpassデータをシンプルなポリゴンに変換
            const element = overpassData.elements[0];
            if (element.members) {
                // Relationの場合、外側のwayを取得
                const outerWays = element.members.filter(m => m.role === 'outer');
                const coordinates = [];

                for (const way of outerWays) {
                    if (way.geometry) {
                        const wayCoords = way.geometry.map(node => [node.lat, node.lon]);
                        coordinates.push(wayCoords);
                    }
                }

                if (coordinates.length > 0) {
                    // 陸地のみ表示の場合、メインランドのみを抽出
                    const displayCoords = landOnly ? extractMainland(coordinates) : coordinates;

                    // 国の形を現在の地図中心に配置
                    const centeredCoordinates = centerPolygonOnMap(displayCoords, currentCenter);

                    const multiPolygon = L.polygon(centeredCoordinates, {
                        color: '#3498db',
                        weight: 3,
                        fillOpacity: 0.2
                    }).addTo(map);

                    countryLayers.push(multiPolygon);
                    const displayMode = landOnly ? '（陸地のみ）' : '';
                    showStatus(`${countryName}の国境を表示しました${displayMode}`);
                    return;
                }
            }
        }

        // NominatimのGeoJSONを使用
        if (geojson) {
            // 陸地のみ表示の場合、メインランドのみを抽出
            const displayGeojson = landOnly ? extractMainlandFromGeoJSON(geojson) : geojson;

            // GeoJSONを現在の地図中心に配置
            const centeredGeojson = centerGeoJSONOnMap(displayGeojson, currentCenter);

            const layer = L.geoJSON(centeredGeojson, {
                style: {
                    color: '#3498db',
                    weight: 3,
                    fillOpacity: 0.2
                }
            }).addTo(map);

            countryLayers.push(layer);
            const displayMode = landOnly ? '（陸地のみ）' : '';
            showStatus(`${countryName}の国境を表示しました${displayMode}`);
        } else {
            // 最後の手段としてbounding boxを使用
            if (countryData.boundingbox) {
                const bbox = countryData.boundingbox;
                const bounds = [
                    [parseFloat(bbox[0]), parseFloat(bbox[2])],
                    [parseFloat(bbox[1]), parseFloat(bbox[3])]
                ];

                // 国の形を現在の地図中心に配置
                const centeredBounds = centerShapeOnMap(bounds, currentCenter);

                const rectangle = L.rectangle(centeredBounds, {
                    color: '#3498db',
                    weight: 3,
                    fillOpacity: 0.2
                }).addTo(map);

                countryLayers.push(rectangle);
                showStatus(`${countryName}の範囲を表示しました（簡易表示）`);
            } else {
                throw new Error('国境データの表示に失敗しました');
            }
        }

    } catch (error) {
        showStatus(`エラー: ${error.message}`, true);
        console.error('Error:', error);
    }
}

// すべての国境レイヤーをクリアする関数
function clearCountryBorders() {
    countryLayers.forEach(layer => {
        map.removeLayer(layer);
    });
    countryLayers = [];

    // 中心ピンも削除
    if (centerMarker) {
        map.removeLayer(centerMarker);
        centerMarker = null;
    }

    showStatus('国境表示をクリアしました');
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
    const countryName = document.getElementById('countryInput').value.trim();
    if (countryName) {
        showCountryBorder(countryName);
    } else {
        showStatus('国名を入力してください', true);
    }
});

document.getElementById('clearBtn').addEventListener('click', () => {
    clearCountryBorders();
    document.getElementById('countryInput').value = '';
});

document.getElementById('locationBtn').addEventListener('click', () => {
    goToCurrentLocation();
});

// Enterキーで検索
document.getElementById('countryInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('showBtn').click();
    }
});

// 初期メッセージ
showStatus('国名を入力して「表示」ボタンをクリックしてください');
