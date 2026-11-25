import { LeaderboardClient, LeaderboardData } from '../leaderboard/LeaderboardClient';

export class LeaderboardModal {
  private readonly modalEl: HTMLElement | null;
  private readonly tableBodyEl: HTMLElement | null;
  private readonly myRankBox: HTMLElement | null;
  private readonly myRankVal: HTMLElement | null;
  private readonly myScoreVal: HTMLElement | null;
  private readonly refreshBtn: HTMLButtonElement | null;
  private readonly closeBtn: HTMLButtonElement | null;

  private readonly client: LeaderboardClient;

  constructor(client: LeaderboardClient) {
    this.client = client;

    this.modalEl = document.getElementById('leaderboard-modal');
    this.tableBodyEl = document.getElementById('leaderboard-table-body');
    this.myRankBox = document.getElementById('leaderboard-my-rank');
    this.myRankVal = document.getElementById('lb-my-rank-val');
    this.myScoreVal = document.getElementById('lb-my-score-val');
    this.refreshBtn = document.getElementById('btn-leaderboard-refresh') as HTMLButtonElement | null;
    this.closeBtn = document.getElementById('btn-leaderboard-close') as HTMLButtonElement | null;

    this.setupListeners();
  }

  public open(): void {
    if (!this.modalEl) return;
    this.modalEl.style.display = 'flex';
    void this.refresh();
  }

  public close(): void {
    if (!this.modalEl) return;
    this.modalEl.style.display = 'none';
  }

  public async refresh(): Promise<void> {
    if (!this.client.fetchLeaderboard) {
      this.renderMessage('Leaderboard service is currently in offline/mock mode.');
      return;
    }

    this.setLoading(true);
    this.renderMessage('Loading live P2R standings...');

    try {
      const data = await this.client.fetchLeaderboard(20, 0);
      this.renderData(data);
    } catch (_) {
      this.renderMessage('Failed to load leaderboard. Check your network connection.');
    } finally {
      this.setLoading(false);
    }
  }

  private renderData(data: LeaderboardData): void {
    if (this.myRankBox && this.myRankVal && this.myScoreVal) {
      if (data.my_rank) {
        this.myRankBox.style.display = 'flex';
        this.myRankVal.textContent = `#${data.my_rank.rank}`;
        this.myScoreVal.textContent = (data.my_rank.best_score ?? data.my_rank.score).toLocaleString();
      } else {
        this.myRankBox.style.display = 'none';
      }
    }

    if (!this.tableBodyEl) return;
    this.tableBodyEl.innerHTML = '';

    if (!data.leaderboard || data.leaderboard.length === 0) {
      this.renderMessage('No scores recorded yet. Be the first operative!');
      return;
    }

    for (const entry of data.leaderboard) {
      const tr = document.createElement('tr');
      if (entry.rank === 1) tr.className = 'top-1';
      else if (entry.rank === 2) tr.className = 'top-2';
      else if (entry.rank === 3) tr.className = 'top-3';

      const meta = !Array.isArray(entry.data) && entry.data ? entry.data : {};
      const waveVal = typeof meta.wave_reached === 'number' ? String(meta.wave_reached) : '-';
      const killsVal = typeof meta.kills === 'number' ? String(meta.kills) : '-';
      const scoreVal = (entry.best_score ?? entry.score ?? 0).toLocaleString();

      tr.appendChild(this.createCell(`#${entry.rank}`));
      tr.appendChild(this.createCell(entry.player?.name || 'Unknown'));
      tr.appendChild(this.createCell(waveVal, 'right'));
      tr.appendChild(this.createCell(killsVal, 'right'));
      tr.appendChild(this.createCell(scoreVal, 'right'));

      this.tableBodyEl.appendChild(tr);
    }
  }

  private createCell(text: string, align: 'left' | 'right' = 'left'): HTMLTableCellElement {
    const td = document.createElement('td');
    td.textContent = text;
    if (align === 'right') {
      td.style.textAlign = 'right';
      td.style.fontFamily = 'monospace';
    }
    return td;
  }

  private renderMessage(message: string): void {
    if (!this.tableBodyEl) return;
    this.tableBodyEl.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'lb-empty';
    td.textContent = message;
    tr.appendChild(td);
    this.tableBodyEl.appendChild(tr);
  }

  private setLoading(loading: boolean): void {
    if (this.refreshBtn) {
      this.refreshBtn.disabled = loading;
      this.refreshBtn.textContent = loading ? 'LOADING...' : 'REFRESH';
    }
  }

  private setupListeners(): void {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        void this.refresh();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
  }
}
