// wanderland — real-time pixel art character world
(function() {
    if (!HAS_CHARACTER) return;

    var socket = io();
    var canvas = document.getElementById('wanderland-canvas');
    var wrap = document.getElementById('wanderland-wrap');
    var ctx = canvas.getContext('2d');
    var userCountEl = document.getElementById('user-count');
    var msgEl = document.getElementById('wanderland-msg');

    var PIXEL_SIZE = 3;       // each character pixel = 3 screen pixels
    var CHAR_SIZE = 16;       // 16x16 grid
    var CHAR_PX = CHAR_SIZE * PIXEL_SIZE;  // 48px rendered size
    var MOVE_SPEED = 2;       // pixels per frame (click-to-move)
    var IDLE_SPEED = 1;       // pixels per frame (idle wander)
    var IDLE_PAUSE_MIN = 2000;
    var IDLE_PAUSE_MAX = 5000;
    var IDLE_RANGE = 200;     // how far idle wander goes
    var FRAME_INTERVAL = 400; // walk animation frame swap (ms)
    var HI_DURATION = 2000;   // "hi" bubble duration

    var worldWidth = 2000;
    var worldHeight = 1200;
    var cameraX = 0;
    var cameraY = 0;

    var characters = {};  // { user_id: { username, display_name, x, y, targetX, targetY, frameA, frameB, currentFrame, moving, hiUntil, idleTimer } }
    var myId = USER_ID;

    // --- resize canvas ---
    function resizeCanvas() {
        canvas.width = wrap.clientWidth;
        canvas.height = wrap.clientHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // --- socket events ---
    socket.emit('join_wanderland', {
        user_id: USER_ID,
        username: USERNAME,
        display_name: DISPLAY_NAME
    });

    socket.on('wanderland_full', function(data) {
        msgEl.textContent = data.message;
    });

    socket.on('wanderland_state', function(data) {
        myId = data.you;
        worldWidth = data.world_width;
        worldHeight = data.world_height;

        for (var uid in data.characters) {
            addCharacter(uid, data.characters[uid]);
        }
        userCountEl.textContent = Object.keys(characters).length;

        // Center camera on our character
        if (characters[myId]) {
            centerCamera(characters[myId].x, characters[myId].y);
        }

        // Start idle wandering for all characters
        for (var uid in characters) {
            startIdleWander(uid);
        }
    });

    socket.on('character_joined', function(data) {
        var uid = data.user_id;
        addCharacter(uid, data);
        startIdleWander(uid);
        userCountEl.textContent = Object.keys(characters).length;
    });

    socket.on('character_left', function(data) {
        var uid = data.user_id;
        if (characters[uid]) {
            if (characters[uid].idleTimer) clearTimeout(characters[uid].idleTimer);
            delete characters[uid];
        }
        userCountEl.textContent = Object.keys(characters).length;
    });

    socket.on('character_move', function(data) {
        var uid = data.user_id;
        if (!characters[uid]) return;
        characters[uid].targetX = data.target_x;
        characters[uid].targetY = data.target_y;
        characters[uid].moving = true;
        // Cancel idle for other characters when they get a move command
        if (uid !== myId && characters[uid].idleTimer) {
            clearTimeout(characters[uid].idleTimer);
        }
    });

    socket.on('character_hi', function(data) {
        var uid = data.user_id;
        if (!characters[uid]) return;
        characters[uid].hiUntil = Date.now() + HI_DURATION;
    });

    // --- character management ---
    function addCharacter(uid, data) {
        characters[uid] = {
            username: data.username,
            display_name: data.display_name,
            x: data.x,
            y: data.y,
            targetX: data.target_x || data.x,
            targetY: data.target_y || data.y,
            frameA: data.frame_a,
            frameB: data.frame_b,
            currentFrame: 0,
            moving: false,
            hiUntil: 0,
            idleTimer: null,
            isIdle: true
        };
    }

    // --- idle wandering ---
    function startIdleWander(uid) {
        var c = characters[uid];
        if (!c) return;

        function wander() {
            if (!characters[uid]) return;
            c = characters[uid];

            // Pick a random nearby target
            var dx = (Math.random() - 0.5) * IDLE_RANGE * 2;
            var dy = (Math.random() - 0.5) * IDLE_RANGE * 2;
            var tx = Math.max(20, Math.min(worldWidth - 20, c.x + dx));
            var ty = Math.max(20, Math.min(worldHeight - 20, c.y + dy));

            c.targetX = tx;
            c.targetY = ty;
            c.moving = true;
            c.isIdle = true;

            // Report idle target to server
            if (uid === myId) {
                socket.emit('idle_update', {
                    user_id: myId,
                    target_x: tx,
                    target_y: ty
                });
            }

            // Schedule next wander after arrival + pause
            var dist = Math.sqrt(dx * dx + dy * dy);
            var travelTime = (dist / IDLE_SPEED) * (1000 / 60);
            var pause = IDLE_PAUSE_MIN + Math.random() * (IDLE_PAUSE_MAX - IDLE_PAUSE_MIN);

            c.idleTimer = setTimeout(wander, travelTime + pause);
        }

        // Start after a random delay
        var initialDelay = Math.random() * 3000;
        c.idleTimer = setTimeout(wander, initialDelay);
    }

    // --- click/tap to move ---
    function getWorldPos(e) {
        var rect = wrap.getBoundingClientRect();
        var p;
        if (e.changedTouches && e.changedTouches.length > 0) {
            p = { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        } else {
            p = { clientX: e.clientX, clientY: e.clientY };
        }
        return {
            x: p.clientX - rect.left + cameraX,
            y: p.clientY - rect.top + cameraY
        };
    }

    function handleTapOrClick(worldX, worldY) {
        // Check if tapping on another character
        var clickedChar = getCharacterAt(worldX, worldY);
        if (clickedChar && clickedChar !== myId) {
            socket.emit('say_hi', { user_id: myId });
            return;
        }

        if (!characters[myId]) return;

        // Cancel idle, move to tap/click point
        var me = characters[myId];
        if (me.idleTimer) clearTimeout(me.idleTimer);
        me.isIdle = false;
        me.targetX = Math.max(0, Math.min(worldWidth, worldX));
        me.targetY = Math.max(0, Math.min(worldHeight, worldY));
        me.moving = true;

        socket.emit('move_to', {
            user_id: myId,
            x: me.targetX,
            y: me.targetY
        });

        // Resume idle after arrival
        var dx = me.targetX - me.x;
        var dy = me.targetY - me.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var travelTime = (dist / MOVE_SPEED) * (1000 / 60);
        me.idleTimer = setTimeout(function() {
            startIdleWander(myId);
        }, travelTime + 1000);
    }

    wrap.addEventListener('click', function(e) {
        var pos = getWorldPos(e);
        handleTapOrClick(pos.x, pos.y);
    });

    // Touch: detect single tap vs double tap
    var lastTap = 0;
    var lastTapPos = { x: 0, y: 0 };
    wrap.addEventListener('touchend', function(e) {
        e.preventDefault();
        var pos = getWorldPos(e);
        var now = Date.now();

        if (now - lastTap < 400 && Math.abs(pos.x - lastTapPos.x) < 30 && Math.abs(pos.y - lastTapPos.y) < 30) {
            // Double tap → portfolio
            var clickedChar = getCharacterAt(pos.x, pos.y);
            if (clickedChar && clickedChar !== myId) {
                window.location.href = '/portfolio/' + characters[clickedChar].username;
            }
            lastTap = 0;
        } else {
            lastTap = now;
            lastTapPos = pos;
            // Delay single tap to distinguish from double tap
            setTimeout(function() {
                if (lastTap === now) {
                    handleTapOrClick(pos.x, pos.y);
                }
            }, 350);
        }
    });

    // Double click = go to portfolio (desktop)
    wrap.addEventListener('dblclick', function(e) {
        var pos = getWorldPos(e);
        var clickedChar = getCharacterAt(pos.x, pos.y);
        if (clickedChar && clickedChar !== myId) {
            window.location.href = '/portfolio/' + characters[clickedChar].username;
        }
    });

    function getCharacterAt(x, y) {
        for (var uid in characters) {
            var c = characters[uid];
            if (x >= c.x - CHAR_PX / 2 && x <= c.x + CHAR_PX / 2 &&
                y >= c.y - CHAR_PX / 2 && y <= c.y + CHAR_PX / 2) {
                return uid;
            }
        }
        return null;
    }

    // --- camera ---
    function centerCamera(x, y) {
        cameraX = x - canvas.width / 2;
        cameraY = y - canvas.height / 2;
        cameraX = Math.max(0, Math.min(worldWidth - canvas.width, cameraX));
        cameraY = Math.max(0, Math.min(worldHeight - canvas.height, cameraY));
    }

    // --- game loop ---
    var lastFrameSwap = 0;
    var animFrame = 0;

    function gameLoop(timestamp) {
        // Swap animation frame
        if (timestamp - lastFrameSwap > FRAME_INTERVAL) {
            animFrame = animFrame === 0 ? 1 : 0;
            lastFrameSwap = timestamp;
        }

        // Move characters
        for (var uid in characters) {
            var c = characters[uid];
            var dx = c.targetX - c.x;
            var dy = c.targetY - c.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 2) {
                var speed = c.isIdle ? IDLE_SPEED : MOVE_SPEED;
                // Pixel-stepped movement (snap to integers)
                var stepX = Math.round((dx / dist) * speed);
                var stepY = Math.round((dy / dist) * speed);
                if (stepX === 0 && stepY === 0) {
                    stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
                    stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
                }
                c.x += stepX;
                c.y += stepY;
                c.moving = true;
            } else {
                c.moving = false;
            }

            // Sync position to server periodically for our character
            if (uid === myId && c.moving) {
                socket.emit('position_update', {
                    user_id: myId,
                    x: c.x,
                    y: c.y
                });
            }
        }

        // Camera follows our character
        if (characters[myId]) {
            centerCamera(characters[myId].x, characters[myId].y);
        }

        // Render
        render(timestamp);
        requestAnimationFrame(gameLoop);
    }

    function render(timestamp) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background — subtle grid
        ctx.strokeStyle = 'rgba(0,0,0,0.03)';
        var gridSize = 50;
        var startX = -(cameraX % gridSize);
        var startY = -(cameraY % gridSize);
        for (var x = startX; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (var y = startY; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw characters
        for (var uid in characters) {
            var c = characters[uid];
            var screenX = c.x - cameraX - CHAR_PX / 2;
            var screenY = c.y - cameraY - CHAR_PX / 2;

            // Skip if off screen
            if (screenX + CHAR_PX < 0 || screenX > canvas.width ||
                screenY + CHAR_PX < 0 || screenY > canvas.height) continue;

            // Draw pixel character
            var frame = (c.moving && animFrame === 1) ? c.frameB : c.frameA;
            if (!frame) frame = c.frameA;
            if (frame) {
                drawCharacter(ctx, frame, screenX, screenY, PIXEL_SIZE);
            } else {
                // No character art — draw a placeholder dot
                ctx.fillStyle = '#7b2d8e';
                ctx.beginPath();
                ctx.arc(screenX + CHAR_PX / 2, screenY + CHAR_PX / 2, 8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Name label
            ctx.fillStyle = uid === myId ? '#7b2d8e' : '#666';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(c.display_name, screenX + CHAR_PX / 2, screenY - 4);

            // "hi" bubble
            if (c.hiUntil && Date.now() < c.hiUntil) {
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#ccc';
                var bubbleX = screenX + CHAR_PX / 2;
                var bubbleY = screenY - 20;
                ctx.beginPath();
                ctx.roundRect(bubbleX - 14, bubbleY - 12, 28, 16, 4);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#000';
                ctx.font = '11px Arial';
                ctx.fillText('hi', bubbleX, bubbleY);
            }
        }
    }

    function drawCharacter(ctx, frame, x, y, px) {
        for (var row = 0; row < 16; row++) {
            if (!frame[row]) continue;
            for (var col = 0; col < 16; col++) {
                if (frame[row][col]) {
                    ctx.fillStyle = frame[row][col];
                    ctx.fillRect(x + col * px, y + row * px, px, px);
                }
            }
        }
    }

    // Start
    requestAnimationFrame(gameLoop);
})();
