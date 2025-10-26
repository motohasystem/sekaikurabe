/**
 * VoiceInputWidget - 音声入力ウィジェット
 *
 * マウスホバーで音声認識を開始し、認識結果をテキストエリアに入力するウィジェット
 *
 * @example
 * const widget = new VoiceInputWidget({
 *   targetIds: ['word1', 'word2', 'word3'],
 *   maxLength: 20,
 *   extractNoun: true
 * });
 */
class VoiceInputWidget {
    constructor(options = {}) {
        // デバイス検出を先に実行
        const isTouchDevice = this.isTouchDevice();

        // オプションのデフォルト値
        this.options = {
            targetIds: options.targetIds || [],
            maxLength: options.maxLength || 20,
            extractNoun: options.extractNoun !== false, // デフォルトtrue
            extractNounPhraseOnly: options.extractNounPhraseOnly || false, // 名詞句のみ抽出モード
            triggerText: options.triggerText || (isTouchDevice ? 'タップで音声入力' : 'ホバーで音声入力'),
            activeText: options.activeText || '音声入力中...',
            unsupportedText: options.unsupportedText || '音声認識が利用できません',
            onWordExtracted: options.onWordExtracted || null,
            kuromojiDicPath: options.kuromojiDicPath || 'node_modules/kuromoji/dict/',
            position: options.position || 'fixed', // 'fixed' または 'inline'
            autoTriggerButton: options.autoTriggerButton || null // 自動実行するボタンのID
        };

        // 状態管理
        this.recognition = null;
        this.isRecording = false;
        this.currentIndex = 0;
        this.kuromojiTokenizer = null;
        this.speechRecognitionAvailable = false;
        this.targetInputs = [];

        // 初期化
        this.init();
    }

    /**
     * タッチデバイスかどうかを判定
     */
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * iOS Safariかどうかを判定
     */
    isIOSSafari() {
        const userAgent = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS/.test(userAgent);
    }

    /**
     * 初期化処理
     */
    init() {
        // ターゲット要素を取得
        this.targetInputs = this.options.targetIds
            .map(id => document.getElementById(id))
            .filter(el => el !== null);

        if (this.targetInputs.length === 0) {
            console.error('VoiceInputWidget: ターゲット要素が見つかりません');
            return;
        }

        // Kuromojiの初期化
        if (this.options.extractNoun && typeof kuromoji !== 'undefined') {
            this.initKuromoji();
        }

        // UIの作成
        this.createUI();

        // 音声認識の初期化
        this.initSpeechRecognition();
    }

    /**
     * Kuromojiの初期化
     */
    initKuromoji() {
        kuromoji.builder({ dicPath: this.options.kuromojiDicPath }).build((err, tokenizer) => {
            if (err) {
                console.error('Kuromoji初期化エラー:', err);
                return;
            }
            this.kuromojiTokenizer = tokenizer;
            console.log('Kuromoji初期化完了');
        });
    }

    /**
     * UIの作成
     */
    createUI() {
        // コンテナを作成
        const container = document.createElement('div');
        container.className = 'voice-input-widget-container';

        // position モードに応じてクラスを追加
        if (this.options.position === 'inline') {
            container.classList.add('voice-input-inline');
        }

        container.innerHTML = `
            <div class="voice-input-trigger-block">
                <span class="voice-input-trigger-text">${this.options.triggerText}</span>
            </div>
            <div class="voice-input-recognition-area">
                <div class="voice-input-recognition-text"></div>
            </div>
        `;

        // 配置先を決定
        if (this.options.position === 'inline' && this.targetInputs.length > 0) {
            // inline モード: 最初のターゲット要素の親に追加
            const targetParent = this.targetInputs[0].parentElement;
            targetParent.appendChild(container);
        } else {
            // fixed モード: bodyに追加
            document.body.appendChild(container);
        }

        // DOM要素を保存
        this.trigger = container.querySelector('.voice-input-trigger-block');
        this.recognitionArea = container.querySelector('.voice-input-recognition-area');
        this.recognitionText = container.querySelector('.voice-input-recognition-text');

        // イベントリスナーを追加
        this.attachEventListeners();
    }

    /**
     * イベントリスナーの追加
     */
    attachEventListeners() {
        // iOS対応: タッチデバイスではタップイベントを使用
        if (this.isTouchDevice()) {
            this.trigger.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startRecognition();
            });
            this.trigger.addEventListener('touchend', (e) => {
                e.preventDefault();
                // タッチデバイスでは一定時間後に自動停止
                setTimeout(() => this.stopRecognition(), 5000);
            });
            // フォールバック用のクリックイベント
            this.trigger.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.isRecording) {
                    this.startRecognition();
                } else {
                    this.stopRecognition();
                }
            });
        } else {
            // デスクトップではマウスイベント
            this.trigger.addEventListener('mouseenter', () => this.startRecognition());
            this.trigger.addEventListener('mouseleave', () => this.stopRecognition());
        }
    }

    /**
     * 音声認識の初期化
     */
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.showUnsupportedMessage();
            return;
        }

        // APIの可用性をテスト
        try {
            const testRecognition = new SpeechRecognition();
            testRecognition.lang = 'ja-JP';
            this.speechRecognitionAvailable = true;
            console.log('音声認識API利用可能');
        } catch (e) {
            console.error('音声認識API初期化エラー:', e);
            this.showUnsupportedMessage();
            return;
        }

        // 音声認識インスタンスを作成
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';

        // iOS Safari対応: continuousとinterimResultsの設定を調整
        if (this.isIOSSafari()) {
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
        } else {
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
        }

        // イベントハンドラを設定
        this.recognition.onresult = (event) => this.handleRecognitionResult(event);
        this.recognition.onerror = (event) => this.handleRecognitionError(event);
        this.recognition.onend = () => this.handleRecognitionEnd();
    }

    /**
     * 音声認識結果の処理
     */
    handleRecognitionResult(event) {
        if (!this.isRecording) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // 認識結果を吹き出しに表示
        this.recognitionText.textContent = finalTranscript || interimTranscript;

        // 確定した音声のみ処理
        if (finalTranscript) {
            this.processRecognizedText(finalTranscript);
        }
    }

    /**
     * 音声認識エラーの処理
     */
    handleRecognitionError(event) {
        console.error('音声認識エラー:', event.error);
        if (event.error === 'network' || event.error === 'not-allowed') {
            this.isRecording = false;
            this.trigger.classList.remove('voice-input-active');
            this.recognitionArea.classList.remove('voice-input-visible');
            this.showUnsupportedMessage();
        }
    }

    /**
     * 音声認識終了の処理
     */
    handleRecognitionEnd() {
        if (this.isRecording) {
            // iOS Safari対応: continuousがfalseの場合は自動再開しない
            if (!this.isIOSSafari() && this.recognition.continuous) {
                try {
                    this.recognition.start();
                } catch (e) {
                    console.error('再開エラー:', e);
                    this.isRecording = false;
                    this.trigger.classList.remove('voice-input-active');
                    this.trigger.querySelector('.voice-input-trigger-text').textContent = this.options.triggerText;
                }
            } else {
                // iOS Safariでは一回の認識で終了
                this.stopRecognition();
            }
        }
    }

    /**
     * 認識されたテキストの処理
     */
    processRecognizedText(text) {
        console.log('認識テキスト:', text, 'length:', text.length);

        let wordToDisplay = text;

        // 名詞句のみ抽出モード
        if (this.options.extractNounPhraseOnly && this.kuromojiTokenizer) {
            const extractedNoun = this.extractFirstNoun(text);
            if (extractedNoun) {
                wordToDisplay = extractedNoun;
                console.log('名詞句のみ抽出:', extractedNoun);
            } else {
                console.log('名詞句が見つからないため元のテキストを使用');
            }
        }
        // 通常モード: 20文字を超える場合のみ名詞を抽出
        else if (this.options.extractNoun && text.length > this.options.maxLength && this.kuromojiTokenizer) {
            const extractedNoun = this.extractFirstNoun(text);
            if (extractedNoun) {
                wordToDisplay = extractedNoun;
                console.log(`${this.options.maxLength}文字超のため最初の名詞句を抽出:`, extractedNoun);
            } else {
                console.log('名詞句が見つからないため元のテキストを使用');
            }
        }

        console.log('表示する単語:', wordToDisplay);

        // テキストエリアに表示
        this.targetInputs[this.currentIndex].value = wordToDisplay;
        
        // 自動実行機能: 対応するボタンを自動クリック
        if (this.options.autoTriggerButton) {
            const targetInput = this.targetInputs[this.currentIndex];
            const buttonId = this.options.autoTriggerButton;
            const button = document.getElementById(buttonId);
            
            if (button) {
                // 少し遅延を入れてボタンをクリック
                setTimeout(() => {
                    button.click();
                    console.log(`音声入力後に${buttonId}ボタンを自動実行しました`);
                }, 500);
            }
        }
        
        this.currentIndex = (this.currentIndex + 1) % this.targetInputs.length;

        // カスタムコールバック
        if (this.options.onWordExtracted) {
            this.options.onWordExtracted(wordToDisplay);
        }

        // 吹き出しをクリア
        this.recognitionText.textContent = '';
    }

    /**
     * テキストから最初の連続名詞を抽出
     */
    extractFirstNoun(text) {
        const tokens = this.kuromojiTokenizer.tokenize(text);
        console.log('全トークン:', tokens.map(t => `${t.surface_form}(${t.pos})`));

        let foundNoun = '';
        let currentNoun = '';

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const surface = token.surface_form.trim();

            if (token.pos === '名詞' || token.pos === '接頭詞' || token.pos === '接尾辞') {
                currentNoun += surface;
            } else if (token.pos === '記号' && currentNoun) {
                continue;
            } else {
                if (currentNoun && currentNoun.length <= this.options.maxLength) {
                    foundNoun = currentNoun;
                    break;
                }
                currentNoun = '';
            }
        }

        if (!foundNoun && currentNoun && currentNoun.length <= this.options.maxLength) {
            foundNoun = currentNoun;
        }

        return foundNoun;
    }

    /**
     * 音声認識を開始
     */
    startRecognition() {
        if (!this.speechRecognitionAvailable || !this.recognition) return;

        if (!this.isRecording) {
            this.isRecording = true;
            this.trigger.classList.add('voice-input-active');
            this.trigger.querySelector('.voice-input-trigger-text').textContent = this.options.activeText;
            this.recognitionArea.classList.add('voice-input-visible');

            try {
                this.recognition.start();
            } catch (e) {
                console.error('音声認識開始エラー:', e);
                this.showUnsupportedMessage();
            }
        }
    }

    /**
     * 音声認識を停止
     */
    stopRecognition() {
        if (this.isRecording && this.recognition) {
            this.isRecording = false;
            this.trigger.classList.remove('voice-input-active');
            this.trigger.querySelector('.voice-input-trigger-text').textContent = this.options.triggerText;
            this.recognitionArea.classList.remove('voice-input-visible');
            this.recognitionText.textContent = '';
            this.recognition.stop();
        }
    }

    /**
     * 非対応メッセージの表示
     */
    showUnsupportedMessage() {
        this.trigger.style.cursor = 'not-allowed';
        this.trigger.style.opacity = '0.6';
        this.trigger.querySelector('.voice-input-trigger-text').innerHTML =
            `${this.options.unsupportedText}<br><small style="font-size: 12px;">Chrome、Edge、またはSafariをご利用ください</small>`;
    }

    /**
     * 名詞句のみ抽出モードを設定
     */
    setExtractNounPhraseOnly(enabled) {
        this.options.extractNounPhraseOnly = enabled;
        console.log('名詞句のみ抽出モード:', enabled);
    }

    /**
     * ウィジェットを破棄
     */
    destroy() {
        if (this.recognition) {
            this.recognition.stop();
        }
        const container = document.querySelector('.voice-input-widget-container');
        if (container) {
            container.remove();
        }
    }
}
