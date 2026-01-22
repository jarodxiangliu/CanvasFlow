// State Management
const state = {
  canvasData: null,
  scale: 1,
  translateX: 0,
  translateY: 0,
  isDraggingViewport: false,
  isDraggingNode: false,
  draggedNodeId: null,
  lastMouseX: 0,
  lastMouseY: 0,
  nodes: [],
  edges: [],
  isHandDrawn: false,
  isEditMode: false,
  selectedNodeId: null,
  isExpanded: false,
  originalPositions: new Map(),
};

// DOM Elements
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const canvasContainer = document.getElementById("canvas-container");
const canvasContent = document.getElementById("canvas-content");
const nodesLayer = document.getElementById("nodes-layer");
const edgesLayer = document.getElementById("edges-layer");
const filenameDisplay = document.getElementById("filename-display");
const styleToggle = document.getElementById("style-toggle");
const viewModeBtn = document.getElementById("view-mode-btn");
const editModeBtn = document.getElementById("edit-mode-btn");
const saveBtn = document.getElementById("save-btn");
const layoutToggle = document.getElementById("layout-toggle");
const editToolbar = document.getElementById("edit-toolbar");
const contextMenu = document.getElementById("context-menu");
const nodeModal = document.getElementById("node-modal");
const nodeInput = document.getElementById("node-input");
const zoomLevelDisplay = document.getElementById("zoom-level");

let roughCanvas = null;

// Initialize
function init() {
  setupEventListeners();
  window.addEventListener("resize", () => updateTransform());

  const rc = document.createElement("canvas");
  rc.id = "rough-canvas";
  rc.style.position = "absolute";
  rc.style.top = "0";
  rc.style.left = "0";
  rc.style.pointerEvents = "none";
  rc.style.zIndex = "1";
  canvasContent.insertBefore(rc, nodesLayer);
}

function setupEventListeners() {
  // File Import
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () =>
    dropZone.classList.remove("drag-over"),
  );
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".canvas")) readFile(file);
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) readFile(e.target.files[0]);
  });

  // Canvas Interaction
  canvasContainer.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  canvasContainer.addEventListener("wheel", handleWheel, { passive: false });
  canvasContainer.addEventListener("contextmenu", (e) => e.preventDefault());

  // Mode Switching
  viewModeBtn.onclick = () => setEditMode(false);
  editModeBtn.onclick = () => setEditMode(true);

  // Style Toggle
  styleToggle.addEventListener("change", (e) => {
    state.isHandDrawn = e.target.checked;
    document.body.classList.toggle("hand-drawn", state.isHandDrawn);
    render();
  });

  layoutToggle.addEventListener("change", (e) => {
    toggleLayout(e.target.checked);
  });

  // CRUD Toolbar
  document.getElementById("add-text-node").onclick = () => createNode("text");
  document.getElementById("add-link-node").onclick = () => createNode("link");
  document.getElementById("add-group-node").onclick = () => createNode("group");

  // Context Menu Actions
  document.getElementById("cm-edit").onclick = openEditor;
  document.getElementById("cm-delete").onclick = deleteNode;
  document.getElementById("cm-color").onclick = () => {
    const node = state.nodes.find((n) => n.id === state.selectedNodeId);
    if (node) {
      node.color = ((parseInt(node.color || "0") % 6) + 1).toString();
      render();
      hideContextMenu();
    }
  };

  // Modal Actions
  document.getElementById("modal-cancel").onclick = () =>
    nodeModal.classList.add("hidden");
  document.getElementById("modal-save").onclick = saveNodeEdit;

  // Control Buttons
  document.getElementById("zoom-in").onclick = () => zoom(1.2);
  document.getElementById("zoom-out").onclick = () => zoom(0.8);
  document.getElementById("fit-view").onclick = fitView;
  document.getElementById("close-canvas").onclick = () => {
    canvasContainer.style.display = "none";
    dropZone.style.display = "flex";
  };

  // Global click to hide context menu
  window.addEventListener("click", hideContextMenu);

  // Save File
  saveBtn.onclick = exportCanvas;
}

// Mode Management
function setEditMode(isEdit) {
  state.isEditMode = isEdit;
  viewModeBtn.classList.toggle("active", !isEdit);
  editModeBtn.classList.toggle("active", isEdit);
  saveBtn.classList.toggle("hidden", !isEdit);
  editToolbar.classList.toggle("hidden", !isEdit);
  document
    .getElementById("canvas-viewport")
    .classList.toggle("edit-mode", isEdit);
}

// File Handling
function readFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      loadCanvas(data, file.name);
    } catch (err) {
      alert("Error parsing file.");
    }
  };
  reader.readAsText(file);
}

function loadCanvas(data, filename) {
  state.canvasData = data;
  state.nodes = JSON.parse(JSON.stringify(data.nodes || []));
  state.edges = JSON.parse(JSON.stringify(data.edges || []));
  filenameDisplay.textContent = filename;
  dropZone.style.display = "none";
  canvasContainer.style.display = "block";
  render();
  fitView();
}

function exportCanvas() {
  const data = { nodes: state.nodes, edges: state.edges };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameDisplay.textContent || "canvas_flow.canvas";
  a.click();
}

// CRUD Operations
function createNode(type) {
  const id = Math.random().toString(36).substr(2, 9);
  const centerX = (-state.translateX + window.innerWidth / 2) / state.scale;
  const centerY = (-state.translateY + window.innerHeight / 2) / state.scale;

  const newNode = {
    id,
    type,
    x: centerX - 125,
    y: centerY - 75,
    width: 250,
    height: 150,
    color: "1",
  };

  if (type === "text") newNode.text = "# New Node\nStart typing...";
  else if (type === "link") newNode.url = "https://obsidian.md";
  else if (type === "group") newNode.label = "New Group";

  state.nodes.push(newNode);
  render();
}

function openEditor() {
  const node = state.nodes.find((n) => n.id === state.selectedNodeId);
  if (!node) return;
  nodeInput.value = node.text || node.url || node.label || "";
  nodeModal.classList.remove("hidden");
  hideContextMenu();
}

function saveNodeEdit() {
  const node = state.nodes.find((n) => n.id === state.selectedNodeId);
  if (node) {
    if (node.type === "text") node.text = nodeInput.value;
    else if (node.type === "link") node.url = nodeInput.value;
    else if (node.type === "group") node.label = nodeInput.value;
    render();
  }
  nodeModal.classList.add("hidden");
}

function toggleLayout(expanded) {
  state.isExpanded = expanded;
  if (expanded) {
    // Store original positions
    state.originalPositions.clear();
    state.nodes.forEach((n) => {
      state.originalPositions.set(n.id, { x: n.x, y: n.y });
    });
    applyExpandedLayout();
  } else {
    // Restore original positions
    state.nodes.forEach((n) => {
      const pos = state.originalPositions.get(n.id);
      if (pos) {
        n.x = pos.x;
        n.y = pos.y;
      }
    });
    render();
  }
}

function applyExpandedLayout() {
  if (state.nodes.length === 0) return;

  // Simple Force-Directed inspired spacing to spread things out and reduce overlaps
  const padding = 100;
  const iterations = 50;
  const k = 500; // Optimal distance

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map();
    state.nodes.forEach((n) => disp.set(n.id, { x: 0, y: 0 }));

    // Repulsive forces
    for (let i = 0; i < state.nodes.length; i++) {
      for (let j = i + 1; j < state.nodes.length; j++) {
        const u = state.nodes[i];
        const v = state.nodes[j];
        const dx = u.x - v.x;
        const dy = u.y - v.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (k * k) / dist;
        const xf = (dx / dist) * force;
        const yf = (dy / dist) * force;

        disp.get(u.id).x += xf;
        disp.get(u.id).y += yf;
        disp.get(v.id).x -= xf;
        disp.get(v.id).y -= yf;
      }
    }

    // Attractive forces (along edges)
    state.edges.forEach((edge) => {
      const u = state.nodes.find((n) => n.id === edge.fromNode);
      const v = state.nodes.find((n) => n.id === edge.toNode);
      if (!u || !v) return;

      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist * dist) / k;
      const xf = (dx / dist) * force;
      const yf = (dy / dist) * force;

      disp.get(u.id).x += xf;
      disp.get(u.id).y += yf;
      disp.get(v.id).x -= xf;
      disp.get(v.id).y -= yf;
    });

    // Apply displacements
    const temp = 0.1 * (iterations - iter);
    state.nodes.forEach((n) => {
      const d = disp.get(n.id);
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 1;
      n.x += (d.x / dist) * Math.min(dist, temp);
      n.y += (d.y / dist) * Math.min(dist, temp);
    });
  }

  render();
}

function deleteNode() {
  state.nodes = state.nodes.filter((n) => n.id !== state.selectedNodeId);
  state.edges = state.edges.filter(
    (e) =>
      e.fromNode !== state.selectedNodeId && e.toNode !== state.selectedNodeId,
  );
  render();
  hideContextMenu();
}

// Rendering
function render() {
  nodesLayer.innerHTML = "";
  const rc = document.getElementById("rough-canvas");
  const ctx = rc.getContext("2d");

  // Calculate bounding box for all nodes to size the layers correctly
  let minX = 0,
    minY = 0,
    maxX = 0,
    maxY = 0;
  if (state.nodes.length > 0) {
    minX = state.nodes[0].x;
    minY = state.nodes[0].y;
    state.nodes.forEach((n) => {
      minX = Math.min(minX, n.x - 200);
      minY = Math.min(minY, n.y - 200);
      maxX = Math.max(maxX, n.x + n.width + 200);
      maxY = Math.max(maxY, n.y + n.height + 200);
    });
  }

  if (state.isHandDrawn) {
    rc.width = Math.max(window.innerWidth * 5, maxX - minX);
    rc.height = Math.max(window.innerHeight * 5, maxY - minY);
    rc.style.left = minX + "px";
    rc.style.top = minY + "px";
    ctx.clearRect(0, 0, rc.width, rc.height);
    roughCanvas = rough.canvas(rc);
  } else {
    ctx.clearRect(0, 0, rc.width, rc.height);
    // Size SVG layer to prevent clipping
    edgesLayer.style.left = minX + "px";
    edgesLayer.style.top = minY + "px";
    edgesLayer.style.width = Math.max(1, maxX - minX) + "px";
    edgesLayer.style.height = Math.max(1, maxY - minY) + "px";
  }

  state.nodes.forEach((node) => {
    const div = document.createElement("div");
    div.className = `node node-${node.type || "text"}`;
    div.style.left = `${node.x}px`;
    div.style.top = `${node.y}px`;
    div.style.width = `${node.width}px`;
    div.style.height = `${node.height}px`;

    const color = getColor(node.color);

    if (state.isHandDrawn) {
      const offsetX = -parseFloat(rc.style.left);
      const offsetY = -parseFloat(rc.style.top);
      roughCanvas.rectangle(
        node.x + offsetX,
        node.y + offsetY,
        node.width,
        node.height,
        {
          stroke: color,
          strokeWidth: 1.5,
          roughness: 1,
          fill: node.type === "group" ? color : "transparent",
          fillStyle: "hachure",
        },
      );
    } else {
      div.style.borderColor = color;
      if (node.type === "group")
        div.style.backgroundColor = color
          .replace(")", ", 0.05)")
          .replace("rgb", "rgba");
    }

    const content = document.createElement("div");
    content.className = "node-content";
    if (node.type === "text")
      content.innerHTML = DOMPurify.sanitize(marked.parse(node.text || ""));
    else if (node.type === "file") content.innerHTML = `<b>📄 ${node.file}</b>`;
    else if (node.type === "link")
      content.innerHTML = `<iframe src="${node.url}" style="pointer-events: none; border:none; width:100%; height:100%;"></iframe>`;
    else if (node.type === "group") {
      const lbl = document.createElement("div");
      lbl.className = "node-group-label";
      lbl.textContent = node.label || "";
      div.appendChild(lbl);
    }

    div.appendChild(content);

    div.onmousedown = (e) => {
      if (e.button === 0) {
        // Removed state.isEditMode check to allow dragging in View Mode
        e.stopPropagation();
        state.isDraggingNode = true;
        state.draggedNodeId = node.id;
        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;
      }
    };

    div.oncontextmenu = (e) => {
      if (!state.isEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      state.selectedNodeId = node.id;
      showContextMenu(e.clientX, e.clientY);
    };

    nodesLayer.appendChild(div);
  });
  renderEdges();
}

function renderEdges() {
  edgesLayer.innerHTML = "";
  const rc = document.getElementById("rough-canvas");
  const rcOffsetX = state.isHandDrawn
    ? -parseFloat(rc.style.left)
    : -parseFloat(edgesLayer.style.left || 0);
  const rcOffsetY = state.isHandDrawn
    ? -parseFloat(rc.style.top)
    : -parseFloat(edgesLayer.style.top || 0);

  state.edges.forEach((edge) => {
    const from = state.nodes.find((n) => n.id === edge.fromNode);
    const to = state.nodes.find((n) => n.id === edge.toNode);
    if (!from || !to) return;

    const start = getAttachment(from, edge.fromSide || "right");
    const end = getAttachment(to, edge.toSide || "left");
    const color = edge.color ? getColor(edge.color) : "#cbd5e1";

    if (state.isHandDrawn) {
      const points = getCurvePoints(start, end, edge.fromSide, edge.toSide);
      roughCanvas.curve(
        points.map((p) => [p.x + rcOffsetX, p.y + rcOffsetY]),
        { stroke: color, strokeWidth: 1.5 },
      );
    } else {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      const adjStart = { x: start.x + rcOffsetX, y: start.y + rcOffsetY };
      const adjEnd = { x: end.x + rcOffsetX, y: end.y + rcOffsetY };
      path.setAttribute(
        "d",
        calculatePath(adjStart, adjEnd, edge.fromSide, edge.toSide),
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      edgesLayer.appendChild(path);
    }
  });
}

// Utils
function getColor(c) {
  const p = {
    1: "rgb(59, 130, 246)",
    2: "rgb(249, 115, 22)",
    3: "rgb(234, 179, 8)",
    4: "rgb(34, 197, 94)",
    5: "rgb(6, 182, 212)",
    6: "rgb(168, 85, 247)",
  };
  return p[c] || "rgb(100, 116, 139)";
}

function getAttachment(n, s) {
  if (s === "top") return { x: n.x + n.width / 2, y: n.y };
  if (s === "bottom") return { x: n.x + n.width / 2, y: n.y + n.height };
  if (s === "left") return { x: n.x, y: n.y + n.height / 2 };
  return { x: n.x + n.width, y: n.y + n.height / 2 };
}

function calculatePath(s, e, ss, es) {
  const cp = getCP(s, e, ss, es);
  return `M ${s.x} ${s.y} C ${cp.cp1.x} ${cp.cp1.y}, ${cp.cp2.x} ${cp.cp2.y}, ${e.x} ${e.y}`;
}

function getCP(s, e, ss, es) {
  const cur = 60;
  const cp1 = { ...s },
    cp2 = { ...e };
  if (ss === "right") cp1.x += cur;
  else if (ss === "left") cp1.x -= cur;
  else if (ss === "bottom") cp1.y += cur;
  else if (ss === "top") cp1.y -= cur;
  if (es === "right") cp2.x += cur;
  else if (es === "left") cp2.x -= cur;
  else if (es === "bottom") cp2.y += cur;
  else if (es === "top") cp2.y -= cur;
  return { cp1, cp2 };
}

function getCurvePoints(s, e, ss, es) {
  const { cp1, cp2 } = getCP(s, e, ss, es);
  const pts = [];
  for (let t = 0; t <= 1; t += 0.1) {
    pts.push({
      x:
        Math.pow(1 - t, 3) * s.x +
        3 * Math.pow(1 - t, 2) * t * cp1.x +
        3 * (1 - t) * Math.pow(t, 2) * cp2.x +
        Math.pow(t, 3) * e.x,
      y:
        Math.pow(1 - t, 3) * s.y +
        3 * Math.pow(1 - t, 2) * t * cp1.y +
        3 * (1 - t) * Math.pow(t, 2) * cp2.y +
        Math.pow(t, 3) * e.y,
    });
  }
  return pts;
}

// Viewport Controls
function handleMouseDown(e) {
  if (e.button === 0) {
    state.isDraggingViewport = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
  }
}

function handleMouseMove(e) {
  const dx = e.clientX - state.lastMouseX;
  const dy = e.clientY - state.lastMouseY;
  if (state.isDraggingViewport) {
    state.translateX += dx;
    state.translateY += dy;
    updateTransform();
  } else if (state.isDraggingNode) {
    const node = state.nodes.find((n) => n.id === state.draggedNodeId);
    if (node) {
      node.x += dx / state.scale;
      node.y += dy / state.scale;
      render();
    }
  }
  state.lastMouseX = e.clientX;
  state.lastMouseY = e.clientY;
}

function handleMouseUp() {
  state.isDraggingViewport = false;
  state.isDraggingNode = false;
}

function handleWheel(e) {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  const rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left,
    my = e.clientY - rect.top;
  const cx = (mx - state.translateX) / state.scale,
    cy = (my - state.translateY) / state.scale;
  state.scale = Math.max(0.1, Math.min(3, state.scale * factor));
  state.translateX = mx - cx * state.scale;
  state.translateY = my - cy * state.scale;
  updateTransform();
}

function updateTransform() {
  canvasContent.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
  zoomLevelDisplay.textContent = `${Math.round(state.scale * 100)}%`;
}

function zoom(f) {
  const cx = window.innerWidth / 2,
    cy = window.innerHeight / 2;
  const ccx = (cx - state.translateX) / state.scale,
    ccy = (cy - state.translateY) / state.scale;
  state.scale = Math.max(0.1, Math.min(3, state.scale * f));
  state.translateX = cx - ccx * state.scale;
  state.translateY = cy - ccy * state.scale;
  updateTransform();
}

function fitView() {
  if (!state.nodes.length) return;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  state.nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });
  const pad = 80,
    cw = maxX - minX + pad * 2,
    ch = maxY - minY + pad * 2;
  state.scale = Math.min(
    window.innerWidth / cw,
    (window.innerHeight - 100) / ch,
    1,
  );
  state.translateX =
    (window.innerWidth - (maxX - minX) * state.scale) / 2 - minX * state.scale;
  state.translateY =
    (window.innerHeight - (maxY - minY) * state.scale) / 2 -
    minY * state.scale +
    32;
  updateTransform();
}

function showContextMenu(x, y) {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
}

init();
