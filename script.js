const W = 8,
    H = 8;

const CellState = {
    EMPTY: 0,
    MISS: 1,
    HIT: 2,
    SUNK: 3,
};

class Board {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.grid = this._createEmpty();
    }

    _createEmpty() {
        return Array.from({
            length: H
        }, () => Array(W).fill(CellState.EMPTY));
    }

    reset() {
        this.grid = this._createEmpty();
        this.render();
        this.container.querySelectorAll('.cell').forEach(x => x.style.boxShadow = '');
        document.querySelector('.message').textContent = (localStorage.getItem("lang") === "ru")
            ? "Осталось: квадрат 1, треугольники 2, домино 3, мина 1"
            : "Remaining: square 1, triangles 2, domino 3, mine 1";
    }

    toggleCell(r, c, reverse = false) {
        if (reverse)
            this.grid[r][c] = (this.grid[r][c] + 3) % 4;
        else
            this.grid[r][c] = (this.grid[r][c] + 1) % 4;
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const div = document.createElement('div');
                div.className = 'cell ' + this._stateClass(this.grid[r][c]);
                div.id = Board.cellId(r, c);
                div.dataset.r = r;
                div.dataset.c = c;

                const mark = document.createElement('div');
                mark.className = 'mark';
                if (this.grid[r][c] === CellState.MISS) mark.textContent = '•';
                if (this.grid[r][c] === CellState.HIT) mark.textContent = '✕';
                if (this.grid[r][c] === CellState.SUNK) mark.textContent = '■';
                div.appendChild(mark);

                div.addEventListener('click', () => this.toggleCell(r, c));
                div.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.toggleCell(r, c, true);
                });
                
                this.container.appendChild(div);
            }
        }
    }

    _stateClass(state) {
        switch (state) {
            case CellState.EMPTY:
                return 'state-empty';
            case CellState.MISS:
                return 'state-miss';
            case CellState.HIT:
                return 'state-hit';
            case CellState.SUNK:
                return 'state-sunk';
        }
    }

    static cellId(r, c) {
        return `c_${r}_${c}`;
    }
}

class ShipPlacer {
    static genSquare() {
        const placements = [];
        for (let r = 0; r <= H - 2; r++)
            for (let c = 0; c <= W - 2; c++) {
                placements.push([
                    [r, c],
                    [r, c + 1],
                    [r + 1, c],
                    [r + 1, c + 1]
                ]);
            }
        return placements;
    }

    static genTriangle() {
        const placements = [];
        for (let r = 0; r <= H - 2; r++)
            for (let c = 0; c <= W - 2; c++) {
                const base = [
                    [r, c],
                    [r, c + 1],
                    [r + 1, c],
                    [r + 1, c + 1]
                ];
                for (let missing = 0; missing < 4; missing++) {
                    placements.push(base.filter((_, i) => i !== missing));
                }
            }
        return placements;
    }

    static genDomino() {
        const placements = [];
        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++) {
                if (c + 1 < W) placements.push([
                    [r, c],
                    [r, c + 1]
                ]);
                if (r + 1 < H) placements.push([
                    [r, c],
                    [r + 1, c]
                ]);
            }
        return placements;
    }

    static genMine() {
        const placements = [];
        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++) {
                placements.push([
                    [r, c]
                ]);
            }
        return placements;
    }
}

class Analyzer {
    constructor(board) {
        this.board = board;
    }

    inBounds(r, c) {
        return r >= 0 && r < H && c >= 0 && c < W;
    }

    neighborsAll(cells) {
        const set = new Set();
        for (const [r, c] of cells) {
            for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr,
                        nc = c + dc;
                    if (this.inBounds(nr, nc)) set.add(nr + ',' + nc);
                }
        }
        return [...set].map(s => s.split(',').map(Number));
    }

    placementValid(cells, opts = {
        requireInclude: []
    }) {
        for (const [r, c] of cells) {
            const st = this.board.grid[r][c];
            if (st === CellState.MISS) return false;
            if (st === CellState.SUNK) return false;
        }
        const neigh = this.neighborsAll(cells);
        for (const [nr, nc] of neigh) {
            if (this.board.grid[nr][nc] === CellState.SUNK && !cells.some(p => p[0] === nr && p[1] === nc))
                return false;
        }
        for (const req of opts.requireInclude) {
            if (!cells.some(p => p[0] === req[0] && p[1] === req[1])) return false;
        }
        return true;
    }

    getHitClusters() {
        const vis = Array.from({
            length: H
        }, () => Array(W).fill(false));
        const clusters = [];
        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++) {
                if (this.board.grid[r][c] === CellState.HIT && !vis[r][c]) {
                    const stack = [
                        [r, c]
                    ];
                    const cells = [];
                    vis[r][c] = true;
                    while (stack.length) {
                        const [y, x] = stack.pop();
                        cells.push([y, x]);
                        [
                            [1, 0],
                            [-1, 0],
                            [0, 1],
                            [0, -1]
                        ].forEach(([dy, dx]) => {
                            const ny = y + dy,
                                nx = x + dx;
                            if (this.inBounds(ny, nx) && !vis[ny][nx] && this.board.grid[ny][nx] === CellState.HIT) {
                                vis[ny][nx] = true;
                                stack.push([ny, nx]);
                            }
                        });
                    }
                    clusters.push(cells);
                }
            }
        return clusters;
    }
}

class Game {
    constructor() {
        this.board = new Board('board');
        this.analyzer = new Analyzer(this.board);

        document.getElementById('reset').addEventListener('click', () => this.board.reset());
        document.getElementById('compute').addEventListener('click', () => this.computeAll());

        this.board.render();
    }

    validateField() {
        const sunkClusters = [];
        const vis = Array.from({
            length: H
        }, () => Array(W).fill(false));

        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++) {
                if (this.board.grid[r][c] === CellState.SUNK && !vis[r][c]) {
                    const stack = [
                            [r, c]
                        ],
                        cells = [];
                    vis[r][c] = true;
                    while (stack.length) {
                        const [y, x] = stack.pop();
                        cells.push([y, x]);
                        [
                            [1, 0],
                            [-1, 0],
                            [0, 1],
                            [0, -1]
                        ].forEach(([dy, dx]) => {
                            const ny = y + dy,
                                nx = x + dx;
                            if (ny >= 0 && ny < H && nx >= 0 && nx < W && !vis[ny][nx] && this.board.grid[ny][nx] === CellState.SUNK) {
                                vis[ny][nx] = true;
                                stack.push([ny, nx]);
                            }
                        });
                    }
                    sunkClusters.push(cells);
                }
            }

        const limits = {
            square: 1,
            tri: 2,
            dom: 3,
            mine: 1
        };
        const used = {
            square: 0,
            tri: 0,
            dom: 0,
            mine: 0
        };

        const validForms = {
            square: ShipPlacer.genSquare(),
            tri: ShipPlacer.genTriangle(),
            dom: ShipPlacer.genDomino(),
            mine: ShipPlacer.genMine()
        };

        function sameShape(pl, cluster) {
            return cluster.length === pl.length &&
                cluster.every(c1 => pl.some(c2 => c1[0] === c2[0] && c1[1] === c2[1]));
        }

        for (const cluster of sunkClusters) {
            let matched = false;
            for (const [type, forms] of Object.entries(validForms)) {
                if (forms.some(pl => sameShape(pl, cluster))) {
                    used[type]++;
                    if (used[type] > limits[type]) return false;
                    matched = true;
                    break;
                }
            }
            if (!matched) return false;
        }

        for (let i = 0; i < sunkClusters.length; i++) {
            for (let j = i + 1; j < sunkClusters.length; j++) {
                for (const [y1, x1] of sunkClusters[i]) {
                    for (const [y2, x2] of sunkClusters[j]) {
                        if (Math.abs(y1 - y2) <= 1 && Math.abs(x1 - x2) <= 1) {
                            return false;
                        }
                    }
                }
            }
        }

        const hitClusters = this.analyzer.getHitClusters();
        const analyzer = this.analyzer;
        const validSquares = ShipPlacer.genSquare().filter(pl => analyzer.placementValid(pl));
        const validTris = ShipPlacer.genTriangle().filter(pl => analyzer.placementValid(pl));
        const validDoms = ShipPlacer.genDomino().filter(pl => analyzer.placementValid(pl));
        const validMines = ShipPlacer.genMine().filter(pl => analyzer.placementValid(pl));

        for (const cluster of hitClusters) {
            const covers = (pl) => cluster.every(rp => pl.some(q => q[0] === rp[0] && q[1] === rp[1]));
            const found =
                validSquares.some(covers) ||
                validTris.some(covers) ||
                validDoms.some(covers) ||
                validMines.some(covers);
            if (!found) {
                return false;
            }
        }

        const remaining = this.countRemainingShips();
        const placementsByType = {
            square: validSquares,
            tri: validTris,
            dom: validDoms,
            mine: validMines
        };
        for (const type of ['square', 'tri', 'dom', 'mine']) {
            if (remaining[type] > 0 && placementsByType[type].length === 0) {
                return false;
            }
        }

        return true;
    }


    countRemainingShips() {
        const total = {
            square: 1,
            tri: 2,
            dom: 3,
            mine: 1
        };
        const used = {
            square: 0,
            tri: 0,
            dom: 0,
            mine: 0
        };

        const sunkClusters = [];
        const vis = Array.from({
            length: H
        }, () => Array(W).fill(false));
        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++) {
                if (this.board.grid[r][c] === CellState.SUNK && !vis[r][c]) {
                    const stack = [
                            [r, c]
                        ],
                        cells = [];
                    vis[r][c] = true;
                    while (stack.length) {
                        const [y, x] = stack.pop();
                        cells.push([y, x]);
                        [
                            [1, 0],
                            [-1, 0],
                            [0, 1],
                            [0, -1]
                        ].forEach(([dy, dx]) => {
                            const ny = y + dy,
                                nx = x + dx;
                            if (ny >= 0 && ny < H && nx >= 0 && nx < W && !vis[ny][nx] && this.board.grid[ny][nx] === CellState.SUNK) {
                                vis[ny][nx] = true;
                                stack.push([ny, nx]);
                            }
                        });
                    }
                    sunkClusters.push(cells);
                }
            }

        for (const cluster of sunkClusters) {
            if (ShipPlacer.genSquare().some(pl => this.same(pl, cluster))) {
                used.square++;
            } else if (ShipPlacer.genTriangle().some(pl => this.same(pl, cluster))) {
                used.tri++;
            } else if (ShipPlacer.genDomino().some(pl => this.same(pl, cluster))) {
                used.dom++;
            } else if (ShipPlacer.genMine().some(pl => this.same(pl, cluster))) {
                used.mine++;
            }
        }

        return {
            square: Math.max(0, total.square - used.square),
            tri: Math.max(0, total.tri - used.tri),
            dom: Math.max(0, total.dom - used.dom),
            mine: Math.max(0, total.mine - used.mine)
        };
    }

    same(pl, cluster) {
        return cluster.length === pl.length &&
            cluster.every(c1 => pl.some(c2 => c1[0] === c2[0] && c1[1] === c2[1]));
    }

    computeAll() {
        const msg = document.getElementById('message');
        msg.textContent = "";

        if (!this.validateField()) {
            msg.textContent = (localStorage.getItem("lang") === "ru")
                ? "Невозможное поле: проверь правильность расставленных кораблей"
                : "Impossible field: check if the ships are placed correctly";
            msg.style.color = "#ff6666";
            return;
        }

        const remaining = this.countRemainingShips();
        msg.textContent = (localStorage.getItem("lang") === "ru")
            ? `Осталось: квадрат ${remaining.square}, треугольники ${remaining.tri}, домино ${remaining.dom}, мина ${remaining.mine}`
            : `Remaining: square ${remaining.square}, triangles ${remaining.tri}, domino ${remaining.dom}, mine ${remaining.mine}`;
        msg.style.color = "#9fbbe8";

        const clusters = this.analyzer.getHitClusters();

        let squares = [];
        let tris = [];
        let doms = [];

        if (remaining.square > 0)
            squares = ShipPlacer.genSquare().filter(pl => this.analyzer.placementValid(pl));
        if (remaining.tri > 0)
            tris = ShipPlacer.genTriangle().filter(pl => this.analyzer.placementValid(pl));
        if (remaining.dom > 0)
            doms = ShipPlacer.genDomino().filter(pl => this.analyzer.placementValid(pl));

        let placementsForTarget = [];
        if (clusters.length > 0) {
            for (const cluster of clusters) {
                const req = cluster;
                const sqs = squares.filter(p => req.every(rp => p.some(q => q[0] === rp[0] && q[1] === rp[1])));
                const trs = tris.filter(p => req.every(rp => p.some(q => q[0] === rp[0] && q[1] === rp[1])));
                const dms = doms.filter(p => req.every(rp => p.some(q => q[0] === rp[0] && q[1] === rp[1])));
                placementsForTarget = placementsForTarget.concat(sqs, trs, dms);
            }
        }

        const shipHeat = Array.from({ length: H }, () => Array(W).fill(0));

        if (clusters.length > 0 && placementsForTarget.length > 0) {
            for (const pl of placementsForTarget) {
                for (const [r, c] of pl) shipHeat[r][c] += 1;
            }
        } else {
            for (const pl of squares.concat(tris, doms)) {
                for (const [r, c] of pl) shipHeat[r][c] += 1;
            }
        }

        const normalize = (map) => {
            const flat = map.flat();
            const sum = flat.reduce((a, b) => a + b, 0);
            if (sum === 0) return map.map(row => row.map(() => 0));
            return map.map(row => row.map(v => v / sum));
        };

        const score = normalize(shipHeat);

        const suggestions = [];
        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++) {
                if ([CellState.SUNK, CellState.MISS].includes(this.board.grid[r][c])) continue;
                suggestions.push({ r, c, score: score[r][c] });
            }
        suggestions.sort((a, b) => b.score - a.score);

        this.board.render();
        const maxScore = Math.max(...suggestions.map(s => s.score));
        const minScore = Math.min(...suggestions.map(s => s.score));

        document.querySelectorAll('.cell').forEach(el => el.style.boxShadow = '');
        for (let r = 0; r < H; r++)
            for (let c = 0; c < W; c++) {
                const el = document.getElementById(Board.cellId(r, c));
                const s = score[r][c];
                if ([CellState.MISS, CellState.SUNK].includes(this.board.grid[r][c])) {
                    el.style.opacity = "0.6";
                    continue;
                }
                if (s === 0) continue;
                const norm = maxScore === minScore ? (s > 0 ? 1 : 0) : (s - minScore) / (maxScore - minScore);
                const hue = 220 - Math.round(norm * 220);
                el.style.boxShadow = `inset 0 0 10px hsl(${hue}, 100%, 50%)`;
            }
    }
}

window.addEventListener('DOMContentLoaded', () => new Game());
