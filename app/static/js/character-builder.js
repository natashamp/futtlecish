// character builder — 16x16 pixel art, 2-frame walk cycle
(function() {
    var GRID = 16;
    var COLORS = [
        '#000000', // black
        '#ffffff', // white
        '#e03030', // red
        '#3060e0', // blue
        '#e0d030', // yellow
        '#30b030', // green
        '#e0a070', // skin tone
        '#805030'  // brown
    ];
    var selectedColor = COLORS[0];

    // grid data: 16x16 arrays, null = transparent
    var frameA = createEmptyGrid();
    var frameB = createEmptyGrid();

    // load initial data
    if (INITIAL_A) frameA = JSON.parse(JSON.stringify(INITIAL_A));
    if (INITIAL_B) frameB = JSON.parse(JSON.stringify(INITIAL_B));

    var canvasA = document.getElementById('frame-a');
    var canvasB = document.getElementById('frame-b');
    var preview = document.getElementById('preview');
    var ctxA = canvasA.getContext('2d');
    var ctxB = canvasB.getContext('2d');
    var ctxP = preview.getContext('2d');

    var PX = canvasA.width / GRID; // 320/16 = 20px per cell
    var PPX = preview.width / GRID; // 64/16 = 4px per cell

    var painting = false;
    var erasing = false;

    // --- palette ---
    var palette = document.getElementById('palette');
    COLORS.forEach(function(color) {
        var swatch = document.createElement('div');
        swatch.className = 'swatch' + (color === selectedColor ? ' active' : '');
        swatch.style.background = color;
        if (color === '#ffffff') {
            swatch.style.border = '2px solid #ccc';
        }
        swatch.addEventListener('click', function() {
            selectedColor = color;
            palette.querySelectorAll('.swatch').forEach(function(s) { s.classList.remove('active'); });
            swatch.classList.add('active');
        });
        palette.appendChild(swatch);
    });

    // --- drawing ---
    function getPointerPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    }

    function getCell(canvas, e) {
        var p = getPointerPos(e);
        var rect = canvas.getBoundingClientRect();
        var x = Math.floor((p.clientX - rect.left) / (rect.width / GRID));
        var y = Math.floor((p.clientY - rect.top) / (rect.height / GRID));
        return {x: Math.max(0, Math.min(GRID - 1, x)), y: Math.max(0, Math.min(GRID - 1, y))};
    }

    function paint(grid, cell) {
        if (erasing) {
            grid[cell.y][cell.x] = null;
        } else {
            if (grid[cell.y][cell.x] === selectedColor) {
                grid[cell.y][cell.x] = null;
                erasing = true;
            } else {
                grid[cell.y][cell.x] = selectedColor;
            }
        }
    }

    function setupCanvas(canvas, grid) {
        var ctx = canvas === canvasA ? ctxA : ctxB;

        function startPaint(e) {
            e.preventDefault();
            painting = true;
            erasing = false;
            var cell = getCell(canvas, e);
            paint(grid, cell);
            renderGrid(ctx, grid, PX);
            renderPreview();
        }

        function continuePaint(e) {
            if (!painting) return;
            e.preventDefault();
            var cell = getCell(canvas, e);
            if (erasing) {
                grid[cell.y][cell.x] = null;
            } else {
                grid[cell.y][cell.x] = selectedColor;
            }
            renderGrid(ctx, grid, PX);
            renderPreview();
        }

        canvas.addEventListener('mousedown', startPaint);
        canvas.addEventListener('mousemove', continuePaint);
        canvas.addEventListener('touchstart', startPaint, { passive: false });
        canvas.addEventListener('touchmove', continuePaint, { passive: false });
    }

    function stopPaint() {
        painting = false;
        erasing = false;
    }
    document.addEventListener('mouseup', stopPaint);
    document.addEventListener('touchend', stopPaint);

    setupCanvas(canvasA, frameA);
    setupCanvas(canvasB, frameB);

    // --- rendering ---
    function renderGrid(ctx, grid, px) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // draw checkerboard background for transparency
        for (var y = 0; y < GRID; y++) {
            for (var x = 0; x < GRID; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e8e8' : '#d0d0d0';
                ctx.fillRect(x * px, y * px, px, px);
            }
        }

        // draw pixels
        for (var y = 0; y < GRID; y++) {
            for (var x = 0; x < GRID; x++) {
                if (grid[y][x]) {
                    ctx.fillStyle = grid[y][x];
                    ctx.fillRect(x * px, y * px, px, px);
                }
            }
        }

        // grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        for (var i = 0; i <= GRID; i++) {
            ctx.beginPath();
            ctx.moveTo(i * px, 0);
            ctx.lineTo(i * px, GRID * px);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * px);
            ctx.lineTo(GRID * px, i * px);
            ctx.stroke();
        }
    }

    // --- animated preview ---
    var previewFrame = 0;
    function renderPreview() {
        var grid = previewFrame === 0 ? frameA : frameB;
        ctxP.clearRect(0, 0, preview.width, preview.height);
        ctxP.fillStyle = '#e8e8e8';
        ctxP.fillRect(0, 0, preview.width, preview.height);
        for (var y = 0; y < GRID; y++) {
            for (var x = 0; x < GRID; x++) {
                if (grid[y][x]) {
                    ctxP.fillStyle = grid[y][x];
                    ctxP.fillRect(x * PPX, y * PPX, PPX, PPX);
                }
            }
        }
    }

    setInterval(function() {
        previewFrame = previewFrame === 0 ? 1 : 0;
        renderPreview();
    }, 400);

    // --- buttons ---
    document.getElementById('btn-copy-ab').addEventListener('click', function() {
        frameB = JSON.parse(JSON.stringify(frameA));
        renderGrid(ctxB, frameB, PX);
        renderPreview();
    });

    document.getElementById('btn-clear-a').addEventListener('click', function() {
        frameA = createEmptyGrid();
        renderGrid(ctxA, frameA, PX);
        renderPreview();
    });

    document.getElementById('btn-clear-b').addEventListener('click', function() {
        frameB = createEmptyGrid();
        renderGrid(ctxB, frameB, PX);
        renderPreview();
    });

    document.getElementById('btn-save').addEventListener('click', function() {
        var status = document.getElementById('save-status');
        status.textContent = 'saving...';
        fetch('/portfolio/' + USERNAME + '/character/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({frame_a: frameA, frame_b: frameB})
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            status.textContent = data.ok ? 'saved.' : 'error saving.';
            setTimeout(function() { status.textContent = ''; }, 2000);
        })
        .catch(function() {
            status.textContent = 'error saving.';
        });
    });

    // --- helpers ---
    function createEmptyGrid() {
        var grid = [];
        for (var y = 0; y < GRID; y++) {
            var row = [];
            for (var x = 0; x < GRID; x++) {
                row.push(null);
            }
            grid.push(row);
        }
        return grid;
    }

    // initial render
    renderGrid(ctxA, frameA, PX);
    renderGrid(ctxB, frameB, PX);
    renderPreview();
})();
