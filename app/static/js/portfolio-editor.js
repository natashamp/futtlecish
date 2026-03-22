// portfolio editor — drag-and-drop with vanilla JS
(function() {
    var canvas = document.getElementById('canvas');
    var username = canvas.dataset.username;
    var editMode = false;
    var selected = null;
    var dragging = false;
    var resizing = false;
    var dragOffset = {x: 0, y: 0};
    var dirty = false;

    // --- toolbar ---
    var toolbar = document.getElementById('editor-toolbar');
    var editBtn = document.getElementById('btn-edit-mode');
    var addTextBtn = document.getElementById('btn-add-text');
    var addLinkBtn = document.getElementById('btn-add-link');
    var addImageBtn = document.getElementById('btn-add-image');
    var deleteBtn = document.getElementById('btn-delete');
    var zUpBtn = document.getElementById('btn-z-up');
    var zDownBtn = document.getElementById('btn-z-down');
    var saveBtn = document.getElementById('btn-save');
    var imageInput = document.getElementById('image-upload');
    var saveStatus = document.getElementById('save-status');

    function setEditMode(on) {
        editMode = on;
        toolbar.style.display = on ? 'block' : 'none';
        editBtn.textContent = on ? 'exit edit mode' : 'edit portfolio';
        canvas.classList.toggle('editing', on);
        if (!on && dirty) save();
        if (!on) deselect();
    }

    editBtn.addEventListener('click', function() {
        setEditMode(!editMode);
    });

    // --- add objects ---
    addTextBtn.addEventListener('click', function() {
        var text = prompt('enter text:');
        if (!text) return;
        addObject({type: 'text', content: text, x: 50, y: 50, width: 200, height: 30, z_index: getMaxZ() + 1});
    });

    addLinkBtn.addEventListener('click', function() {
        var url = prompt('enter URL:');
        if (!url) return;
        addObject({type: 'link', content: url, x: 50, y: 50, width: 250, height: 25, z_index: getMaxZ() + 1});
    });

    addImageBtn.addEventListener('click', function() {
        imageInput.click();
    });

    imageInput.addEventListener('change', function() {
        if (!imageInput.files.length) return;
        var formData = new FormData();
        formData.append('image', imageInput.files[0]);
        saveStatus.textContent = 'uploading...';

        fetch('/portfolio/' + username + '/upload', {method: 'POST', body: formData})
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.url) {
                    addObject({type: 'image', content: data.url, x: 50, y: 50, width: 300, height: 300, z_index: getMaxZ() + 1});
                }
                saveStatus.textContent = '';
            });
        imageInput.value = '';
    });

    deleteBtn.addEventListener('click', function() {
        if (!selected) return;
        var id = selected.dataset.objId;
        fetch('/portfolio/' + username + '/objects/' + id, {method: 'DELETE'})
            .then(function() {
                selected.remove();
                selected = null;
                updateToolbarState();
            });
    });

    zUpBtn.addEventListener('click', function() {
        if (!selected) return;
        var z = parseInt(selected.style.zIndex || 0) + 1;
        selected.style.zIndex = z;
        updateObject(selected.dataset.objId, {z_index: z});
    });

    zDownBtn.addEventListener('click', function() {
        if (!selected) return;
        var z = Math.max(0, parseInt(selected.style.zIndex || 0) - 1);
        selected.style.zIndex = z;
        updateObject(selected.dataset.objId, {z_index: z});
    });

    saveBtn.addEventListener('click', save);

    // --- CRUD helpers ---
    function addObject(data) {
        fetch('/portfolio/' + username + '/objects', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(function(r) { return r.json(); })
        .then(function(obj) {
            renderObject(obj);
            dirty = true;
        });
    }

    function updateObject(id, data) {
        fetch('/portfolio/' + username + '/objects/' + id, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        dirty = true;
    }

    function save() {
        var objects = [];
        canvas.querySelectorAll('.portfolio-obj').forEach(function(el) {
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
        fetch('/portfolio/' + username + '/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({objects: objects})
        })
        .then(function() {
            saveStatus.textContent = 'saved.';
            dirty = false;
            setTimeout(function() { saveStatus.textContent = ''; }, 2000);
        });
    }

    function getMaxZ() {
        var max = 0;
        canvas.querySelectorAll('.portfolio-obj').forEach(function(el) {
            var z = parseInt(el.style.zIndex || 0);
            if (z > max) max = z;
        });
        return max;
    }

    // --- rendering ---
    function renderObject(obj) {
        var div = document.createElement('div');
        div.className = 'portfolio-obj type-' + obj.type;
        div.dataset.objId = obj.id;
        div.style.left = obj.x + 'px';
        div.style.top = obj.y + 'px';
        div.style.width = obj.width + 'px';
        div.style.height = obj.height + 'px';
        div.style.zIndex = obj.z_index;

        if (obj.type === 'text') {
            div.innerHTML = '<span>' + escapeHtml(obj.content) + '</span>';
        } else if (obj.type === 'link') {
            div.innerHTML = '<a href="' + escapeHtml(obj.content) + '" target="_blank">' + escapeHtml(obj.content) + '</a>';
        } else if (obj.type === 'image') {
            div.innerHTML = '<img src="' + escapeHtml(obj.content) + '" alt="">';
        }

        // resize handle
        var handle = document.createElement('div');
        handle.className = 'resize-handle';
        div.appendChild(handle);

        canvas.appendChild(div);
        makeInteractive(div, handle);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- selection ---
    function select(el) {
        deselect();
        selected = el;
        el.classList.add('selected');
        updateToolbarState();
    }

    function deselect() {
        if (selected) selected.classList.remove('selected');
        selected = null;
        updateToolbarState();
    }

    function updateToolbarState() {
        var hasSelection = selected !== null;
        deleteBtn.style.display = hasSelection ? 'inline' : 'none';
        zUpBtn.style.display = hasSelection ? 'inline' : 'none';
        zDownBtn.style.display = hasSelection ? 'inline' : 'none';
    }

    // --- drag and resize (mouse + touch) ---
    function getPointer(e) {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    }

    var pinchStartDist = 0;
    var pinchStartW = 0;
    var pinchStartH = 0;

    function makeInteractive(el, handle) {
        // Mouse
        el.addEventListener('mousedown', function(e) {
            if (!editMode) return;
            if (e.target === handle) return;
            e.preventDefault();
            select(el);
            dragging = true;
            var rect = el.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
        });

        handle.addEventListener('mousedown', function(e) {
            if (!editMode) return;
            e.preventDefault();
            e.stopPropagation();
            select(el);
            resizing = true;
        });

        // Touch — tap to select, hold+drag to move
        el.addEventListener('touchstart', function(e) {
            if (!editMode) return;
            if (e.target === handle) return;
            e.preventDefault();
            select(el);

            if (e.touches.length === 2) {
                // Pinch to resize
                pinchStartDist = getTouchDist(e.touches);
                pinchStartW = parseFloat(el.style.width);
                pinchStartH = parseFloat(el.style.height);
                resizing = true;
                return;
            }

            dragging = true;
            var p = getPointer(e);
            var rect = el.getBoundingClientRect();
            dragOffset.x = p.clientX - rect.left;
            dragOffset.y = p.clientY - rect.top;
        }, { passive: false });

        handle.addEventListener('touchstart', function(e) {
            if (!editMode) return;
            e.preventDefault();
            e.stopPropagation();
            select(el);
            resizing = true;
            var p = getPointer(e);
            dragOffset.x = p.clientX;
            dragOffset.y = p.clientY;
        }, { passive: false });
    }

    function getTouchDist(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function onPointerMove(e) {
        if (!editMode) return;
        var p = getPointer(e);
        var canvasRect = canvas.getBoundingClientRect();

        if (dragging && selected) {
            var x = p.clientX - canvasRect.left - dragOffset.x;
            var y = p.clientY - canvasRect.top - dragOffset.y;
            selected.style.left = Math.max(0, x) + 'px';
            selected.style.top = Math.max(0, y) + 'px';
            dirty = true;
        }

        if (resizing && selected) {
            if (e.touches && e.touches.length === 2) {
                // Pinch resize
                var dist = getTouchDist(e.touches);
                var scale = dist / pinchStartDist;
                selected.style.width = Math.max(30, pinchStartW * scale) + 'px';
                selected.style.height = Math.max(20, pinchStartH * scale) + 'px';
            } else {
                var elRect = selected.getBoundingClientRect();
                var w = p.clientX - elRect.left;
                var h = p.clientY - elRect.top;
                selected.style.width = Math.max(30, w) + 'px';
                selected.style.height = Math.max(20, h) + 'px';
            }
            dirty = true;
        }
    }

    function onPointerUp() {
        if (dragging && selected) {
            updateObject(selected.dataset.objId, {
                x: parseFloat(selected.style.left),
                y: parseFloat(selected.style.top)
            });
        }
        if (resizing && selected) {
            updateObject(selected.dataset.objId, {
                width: parseFloat(selected.style.width),
                height: parseFloat(selected.style.height)
            });
        }
        dragging = false;
        resizing = false;
    }

    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', function(e) {
        if (dragging || resizing) e.preventDefault();
        onPointerMove(e);
    }, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);

    canvas.addEventListener('click', function(e) {
        if (!editMode) return;
        if (e.target === canvas) deselect();
    });

    // --- init: make existing objects interactive ---
    canvas.querySelectorAll('.portfolio-obj').forEach(function(el) {
        var handle = document.createElement('div');
        handle.className = 'resize-handle';
        el.appendChild(handle);
        makeInteractive(el, handle);
    });

    updateToolbarState();
})();
