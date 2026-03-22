// business card editor — constrained drag-and-drop
(function() {
    var cardCanvas = document.getElementById('card-canvas');
    var objContainer = document.getElementById('card-objects');
    var username = CARD_USERNAME;
    var selected = null;
    var dragging = false;
    var resizing = false;
    var dragOffset = {x: 0, y: 0};

    var textCountEl = document.getElementById('text-count');
    var linkCountEl = document.getElementById('link-count');
    var saveStatus = document.getElementById('save-status');

    // --- buttons ---
    document.getElementById('btn-add-text').addEventListener('click', function() {
        var count = parseInt(textCountEl.textContent);
        if (count >= MAX_TEXTS) { alert('max ' + MAX_TEXTS + ' text blocks'); return; }
        var text = prompt('enter text:');
        if (!text) return;
        addObject({type: 'text', content: text, x: 10, y: 10 + count * 25, width: 150, height: 20, z_index: count});
    });

    document.getElementById('btn-add-link').addEventListener('click', function() {
        var count = parseInt(linkCountEl.textContent);
        if (count >= MAX_LINKS) { alert('max ' + MAX_LINKS + ' links'); return; }
        var url = prompt('enter URL:');
        if (!url) return;
        addObject({type: 'link', content: url, x: 10, y: 100 + count * 25, width: 180, height: 20, z_index: count});
    });

    document.getElementById('btn-upload-image').addEventListener('click', function() {
        document.getElementById('card-image-upload').click();
    });

    document.getElementById('card-image-upload').addEventListener('change', function() {
        if (!this.files.length) return;
        var formData = new FormData();
        formData.append('image', this.files[0]);
        saveStatus.textContent = 'uploading...';

        fetch('/portfolio/' + username + '/card/upload', {method: 'POST', body: formData})
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.url) {
                    var existing = document.getElementById('card-bg-img');
                    if (existing) {
                        existing.src = data.url;
                    } else {
                        var img = document.createElement('img');
                        img.src = data.url;
                        img.className = 'card-editor-bg';
                        img.id = 'card-bg-img';
                        cardCanvas.insertBefore(img, cardCanvas.firstChild);
                    }
                }
                saveStatus.textContent = '';
            });
        this.value = '';
    });

    var removeBtn = document.getElementById('btn-remove-image');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            fetch('/portfolio/' + username + '/card/remove-image', {method: 'POST'})
                .then(function() {
                    var img = document.getElementById('card-bg-img');
                    if (img) img.remove();
                    removeBtn.style.display = 'none';
                });
        });
    }

    document.getElementById('btn-toggle-char').addEventListener('click', function() {
        var btn = this;
        fetch('/portfolio/' + username + '/card/toggle-character', {method: 'POST'})
            .then(function(r) { return r.json(); })
            .then(function(data) {
                btn.textContent = data.show_character ? 'hide character' : 'show character';
                var indicator = document.getElementById('card-char-indicator');
                if (data.show_character) {
                    if (!indicator) {
                        indicator = document.createElement('div');
                        indicator.id = 'card-char-indicator';
                        indicator.textContent = 'character \u2713';
                        cardCanvas.appendChild(indicator);
                    }
                } else if (indicator) {
                    indicator.remove();
                }
            });
    });

    var deleteBtn = document.getElementById('btn-delete');
    var zUpBtn = document.getElementById('btn-z-up');
    var zDownBtn = document.getElementById('btn-z-down');

    deleteBtn.addEventListener('click', function() {
        if (!selected) return;
        var id = selected.dataset.objId;
        var type = selected.dataset.type;
        fetch('/portfolio/' + username + '/card/objects/' + id, {method: 'DELETE'})
            .then(function() {
                selected.remove();
                if (type === 'text') textCountEl.textContent = parseInt(textCountEl.textContent) - 1;
                if (type === 'link') linkCountEl.textContent = parseInt(linkCountEl.textContent) - 1;
                selected = null;
                updateToolbar();
            });
    });

    zUpBtn.addEventListener('click', function() {
        if (!selected) return;
        var z = parseInt(selected.style.zIndex || 0) + 1;
        selected.style.zIndex = z;
        updateObj(selected.dataset.objId, {z_index: z});
    });

    zDownBtn.addEventListener('click', function() {
        if (!selected) return;
        var z = Math.max(0, parseInt(selected.style.zIndex || 0) - 1);
        selected.style.zIndex = z;
        updateObj(selected.dataset.objId, {z_index: z});
    });

    document.getElementById('btn-save').addEventListener('click', save);

    // --- CRUD ---
    function addObject(data) {
        fetch('/portfolio/' + username + '/card/objects', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(function(r) { return r.json(); })
        .then(function(obj) {
            if (obj.error) { alert(obj.error); return; }
            renderObject(obj);
            if (obj.type === 'text') textCountEl.textContent = parseInt(textCountEl.textContent) + 1;
            if (obj.type === 'link') linkCountEl.textContent = parseInt(linkCountEl.textContent) + 1;
        });
    }

    function updateObj(id, data) {
        fetch('/portfolio/' + username + '/card/objects/' + id, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
    }

    function save() {
        var objects = [];
        objContainer.querySelectorAll('.card-editor-obj').forEach(function(el) {
            objects.push({
                id: el.dataset.objId,
                x: parseFloat(el.style.left),
                y: parseFloat(el.style.top),
                width: parseFloat(el.style.width),
                height: parseFloat(el.style.height),
                z_index: parseInt(el.style.zIndex || 0)
            });
        });

        saveStatus.textContent = 'saving...';
        fetch('/portfolio/' + username + '/card/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({objects: objects})
        })
        .then(function() {
            saveStatus.textContent = 'saved.';
            setTimeout(function() { saveStatus.textContent = ''; }, 2000);
        });
    }

    // --- rendering ---
    function renderObject(obj) {
        var div = document.createElement('div');
        div.className = 'card-editor-obj';
        div.dataset.objId = obj.id;
        div.dataset.type = obj.type;
        div.style.left = obj.x + 'px';
        div.style.top = obj.y + 'px';
        div.style.width = obj.width + 'px';
        div.style.height = obj.height + 'px';
        div.style.zIndex = obj.z_index;

        if (obj.type === 'text') {
            div.innerHTML = '<span>' + escapeHtml(obj.content) + '</span>';
        } else if (obj.type === 'link') {
            div.innerHTML = '<span class="card-link-text">' + escapeHtml(obj.content) + '</span>';
        }

        var handle = document.createElement('div');
        handle.className = 'resize-handle';
        div.appendChild(handle);

        objContainer.appendChild(div);
        makeInteractive(div, handle);
    }

    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // --- selection ---
    function selectEl(el) {
        deselect();
        selected = el;
        el.classList.add('selected');
        updateToolbar();
    }

    function deselect() {
        if (selected) selected.classList.remove('selected');
        selected = null;
        updateToolbar();
    }

    function updateToolbar() {
        var has = selected !== null;
        deleteBtn.style.display = has ? 'inline' : 'none';
        zUpBtn.style.display = has ? 'inline' : 'none';
        zDownBtn.style.display = has ? 'inline' : 'none';
    }

    // --- drag and resize (mouse + touch) ---
    function getPointer(e) {
        if (e.touches && e.touches.length > 0)
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        return { clientX: e.clientX, clientY: e.clientY };
    }

    function makeInteractive(el, handle) {
        function startDrag(e) {
            if (e.target === handle) return;
            e.preventDefault();
            selectEl(el);
            dragging = true;
            var p = getPointer(e);
            var rect = el.getBoundingClientRect();
            dragOffset.x = p.clientX - rect.left;
            dragOffset.y = p.clientY - rect.top;
        }

        function startResize(e) {
            e.preventDefault();
            e.stopPropagation();
            selectEl(el);
            resizing = true;
        }

        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag, { passive: false });
        handle.addEventListener('mousedown', startResize);
        handle.addEventListener('touchstart', startResize, { passive: false });
    }

    function onMove(e) {
        var p = getPointer(e);
        var canvasRect = cardCanvas.getBoundingClientRect();

        if (dragging && selected) {
            var x = p.clientX - canvasRect.left - dragOffset.x;
            var y = p.clientY - canvasRect.top - dragOffset.y;
            x = Math.max(0, Math.min(cardCanvas.offsetWidth - selected.offsetWidth, x));
            y = Math.max(0, Math.min(cardCanvas.offsetHeight - selected.offsetHeight, y));
            selected.style.left = x + 'px';
            selected.style.top = y + 'px';
        }

        if (resizing && selected) {
            var elRect = selected.getBoundingClientRect();
            var w = Math.max(30, p.clientX - elRect.left);
            var h = Math.max(15, p.clientY - elRect.top);
            var maxW = cardCanvas.offsetWidth - parseFloat(selected.style.left);
            var maxH = cardCanvas.offsetHeight - parseFloat(selected.style.top);
            selected.style.width = Math.min(w, maxW) + 'px';
            selected.style.height = Math.min(h, maxH) + 'px';
        }
    }

    function onEnd() {
        if (dragging && selected) {
            updateObj(selected.dataset.objId, {
                x: parseFloat(selected.style.left),
                y: parseFloat(selected.style.top)
            });
        }
        if (resizing && selected) {
            updateObj(selected.dataset.objId, {
                width: parseFloat(selected.style.width),
                height: parseFloat(selected.style.height)
            });
        }
        dragging = false;
        resizing = false;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', function(e) {
        if (dragging || resizing) e.preventDefault();
        onMove(e);
    }, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    cardCanvas.addEventListener('click', function(e) {
        if (e.target === cardCanvas || e.target === objContainer) deselect();
    });

    // --- init existing objects ---
    objContainer.querySelectorAll('.card-editor-obj').forEach(function(el) {
        var handle = el.querySelector('.resize-handle');
        makeInteractive(el, handle);
    });

    updateToolbar();
})();
