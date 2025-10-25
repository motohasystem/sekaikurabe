/**
 * Tutorial Widget
 * Webアプリに組み込んで使えるチュートリアルウィジェット
 */
class TutorialWidget {
  constructor(config) {
    this.config = config;
    this.currentPage = 0;
    this.pages = [];
    this.storageKey = config.storageKey || 'tutorial-widget-dismissed';
    this.container = null;
    this.contentContainer = null;
  }

  /**
   * 初期化してウィジェットを表示
   */
  async init() {
    // 「次回は表示しない」が設定されているかチェック
    if (localStorage.getItem(this.storageKey) === 'true') {
      return;
    }

    // 設定ファイルを読み込み
    await this.loadConfig();

    // ページがない場合は何もしない
    if (this.pages.length === 0) {
      return;
    }

    // モーダルを作成して表示
    this.createModal();
    this.showPage(0);
  }

  /**
   * 設定ファイルを読み込む
   */
  async loadConfig() {
    try {
      const response = await fetch(this.config.configUrl);
      const data = await response.json();
      this.pages = data.pages || [];
    } catch (error) {
      console.error('Failed to load tutorial config:', error);
    }
  }

  /**
   * モーダルダイアログを作成
   */
  createModal() {
    // オーバーレイとモーダルコンテナを作成
    this.container = document.createElement('div');
    this.container.className = 'tutorial-widget-overlay';
    this.container.innerHTML = `
      <div class="tutorial-widget-modal">
        <button class="tutorial-widget-close" aria-label="閉じる">×</button>
        <div class="tutorial-widget-content"></div>
        <div class="tutorial-widget-footer">
          <label class="tutorial-widget-checkbox">
            <input type="checkbox" id="tutorial-widget-no-show">
            <span>次回は表示しない</span>
          </label>
          <div class="tutorial-widget-buttons">
            <button class="tutorial-widget-nav-btn" id="tutorial-widget-next">つぎへ</button>
          </div>
        </div>
      </div>
    `;

    // イベントリスナーを設定
    const closeBtn = this.container.querySelector('.tutorial-widget-close');
    const navBtn = this.container.querySelector('#tutorial-widget-next');
    const checkbox = this.container.querySelector('#tutorial-widget-no-show');

    closeBtn.addEventListener('click', () => this.close());
    navBtn.addEventListener('click', () => this.nextPage());
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        localStorage.setItem(this.storageKey, 'true');
      } else {
        localStorage.removeItem(this.storageKey);
      }
    });

    // DOMに追加
    document.body.appendChild(this.container);
    this.contentContainer = this.container.querySelector('.tutorial-widget-content');
  }

  /**
   * 指定したページを表示
   */
  async showPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return;
    }

    this.currentPage = pageIndex;
    const page = this.pages[pageIndex];

    // HTMLコンテンツを読み込んで表示
    try {
      const response = await fetch(page.url);
      const html = await response.text();
      this.contentContainer.innerHTML = html;
    } catch (error) {
      console.error('Failed to load page content:', error);
      this.contentContainer.innerHTML = '<p>コンテンツの読み込みに失敗しました。</p>';
    }

    // ナビゲーションボタンのテキストを更新
    const navBtn = this.container.querySelector('#tutorial-widget-next');
    if (pageIndex === this.pages.length - 1) {
      navBtn.textContent = 'おわり';
    } else {
      navBtn.textContent = 'つぎへ';
    }
  }

  /**
   * 次のページに進む（最後のページの場合は閉じる）
   */
  nextPage() {
    if (this.currentPage < this.pages.length - 1) {
      this.showPage(this.currentPage + 1);
    } else {
      this.close();
    }
  }

  /**
   * モーダルを閉じる
   */
  close() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /**
   * 表示状態をリセット（デバッグ用）
   */
  static reset(storageKey = 'tutorial-widget-dismissed') {
    localStorage.removeItem(storageKey);
  }
}

// グローバルに公開
window.TutorialWidget = TutorialWidget;
