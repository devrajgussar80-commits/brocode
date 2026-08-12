import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Download,
  Image as ImageIcon,
  Layers3,
  FolderOpen,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Save,
  MessageCircle,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
} from "lucide-react";

const FONT_OPTIONS = ["Inter", "Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New"];
const EXPORT_TYPES = {
  png: { mime: "image/png", extension: "png", quality: 1 },
  jpeg: { mime: "image/jpeg", extension: "jpg", quality: 0.92 },
  webp: { mime: "image/webp", extension: "webp", quality: 0.92 },
};
const STUDIO_TEMPLATE_KEY = "meta.money.image.studio.saved-template.v1";
const SMS_THEMES = {
  light: { label: "Original Light", top: "#f2f5ff", screen: "#f8faff", bubble: "#eef1fb", text: "#202124", muted: "#4b5563", accent: "#116278", avatar: "#fb923c" },
  dark: { label: "Midnight Dark", top: "#0f172a", screen: "#111827", bubble: "#1f2937", text: "#f8fafc", muted: "#cbd5e1", accent: "#38bdf8", avatar: "#f97316" },
  blue: { label: "Ocean Blue", top: "#dbeafe", screen: "#eff6ff", bubble: "#dbeafe", text: "#172554", muted: "#475569", accent: "#1d4ed8", avatar: "#2563eb" },
  green: { label: "Fresh Green", top: "#dcfce7", screen: "#f0fdf4", bubble: "#d1fae5", text: "#14332a", muted: "#4b635b", accent: "#047857", avatar: "#10b981" },
};
const CANVAS_PRESETS = [
  ["Plan banner", 1200, 675],
  ["Square post", 1080, 1080],
  ["Story", 1080, 1920],
  ["Wide banner", 1600, 600],
  ["Thumbnail", 1280, 720],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const id = () => globalThis.crypto?.randomUUID?.() || `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const hexToRgba = (hex, opacity = 1) => {
  const normalized = String(hex || "#000000").replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(full, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${clamp(opacity, 0, 1)})`;
};
const roundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(Math.max(0, radius), Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
};
const initialLayers = () => [
  {
    id: id(),
    type: "text",
    name: "Headline",
    text: "Build wealth with confidence",
    x: 72,
    y: 105,
    w: 700,
    h: 125,
    fill: "#ffffff",
    fontSize: 64,
    fontWeight: 800,
    fontFamily: "Inter",
    align: "left",
    opacity: 1,
    rotation: 0,
    shadow: true,
  },
  {
    id: id(),
    type: "text",
    name: "Supporting text",
    text: "Flexible plans • Clear returns • Secure access",
    x: 76,
    y: 252,
    w: 650,
    h: 54,
    fill: "#dbeafe",
    fontSize: 27,
    fontWeight: 500,
    fontFamily: "Inter",
    align: "left",
    opacity: 1,
    rotation: 0,
    shadow: false,
  },
  {
    id: id(),
    type: "rect",
    name: "Return badge",
    x: 800,
    y: 110,
    w: 310,
    h: 300,
    fill: "#ffffff",
    stroke: "#bfdbfe",
    strokeWidth: 2,
    radius: 32,
    opacity: 0.96,
    rotation: 0,
    shadow: true,
  },
  {
    id: id(),
    type: "text",
    name: "Badge amount",
    text: "₹1,680",
    x: 835,
    y: 205,
    w: 240,
    h: 72,
    fill: "#0f172a",
    fontSize: 54,
    fontWeight: 800,
    fontFamily: "Inter",
    align: "center",
    opacity: 1,
    rotation: 0,
    shadow: false,
  },
  {
    id: id(),
    type: "text",
    name: "Badge label",
    text: "TOTAL RETURN",
    x: 835,
    y: 290,
    w: 240,
    h: 36,
    fill: "#2563eb",
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "Inter",
    align: "center",
    opacity: 1,
    rotation: 0,
    shadow: false,
  },
];

function newLayer(type, canvasWidth, canvasHeight) {
  const common = {
    id: id(),
    x: Math.round(canvasWidth * 0.2),
    y: Math.round(canvasHeight * 0.2),
    w: Math.round(canvasWidth * 0.4),
    h: Math.round(canvasHeight * 0.18),
    fill: "#ffffff",
    stroke: "#1d4ed8",
    strokeWidth: 0,
    opacity: 1,
    rotation: 0,
    shadow: false,
  };
  if (type === "text") return { ...common, type, name: "New text", text: "Edit this text", fontSize: 48, fontWeight: 700, fontFamily: "Inter", align: "left" };
  if (type === "circle") return { ...common, type, name: "Circle", w: Math.round(canvasHeight * 0.25), h: Math.round(canvasHeight * 0.25), radius: 999 };
  return { ...common, type: "rect", name: "Rectangle", radius: 24 };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawWrappedText(ctx, layer) {
  const lines = [];
  const paragraphs = String(layer.text || "").split("\n");
  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > layer.w) {
        lines.push(line);
        line = word;
      } else line = candidate;
    });
    lines.push(line || " ");
  });
  const lineHeight = layer.fontSize * 1.14;
  const maxLines = Math.max(1, Math.floor(layer.h / lineHeight));
  lines.slice(0, maxLines).forEach((line, index) => {
    const x = layer.align === "center" ? layer.w / 2 : layer.align === "right" ? layer.w : 0;
    ctx.fillText(line, x, layer.fontSize + index * lineHeight, layer.w);
    if (layer.underline && line.trim()) {
      const measuredWidth = Math.min(ctx.measureText(line).width, layer.w);
      const startX = layer.align === "center" ? (layer.w - measuredWidth) / 2 : layer.align === "right" ? layer.w - measuredWidth : 0;
      const underlineY = layer.fontSize + index * lineHeight + 4;
      ctx.beginPath();
      ctx.moveTo(startX, underlineY);
      ctx.lineTo(startX + measuredWidth, underlineY);
      ctx.lineWidth = Math.max(1, layer.fontSize / 18);
      ctx.strokeStyle = layer.fill;
      ctx.stroke();
    }
  });
}

export default function AdminImageStudio({ plans = [], busy = false, onApplyToPlan }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const baseImageInputRef = useRef(null);
  const messageLogoInputRef = useRef(null);
  const imageCache = useRef(new Map());
  const dragRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 675 });
  const [background, setBackground] = useState({ type: "gradient", color1: "#071b4b", color2: "#2563eb", angle: 135 });
  const [columns, setColumns] = useState({ count: 2, gap: 24, opacity: 0.18, colors: ["#2563eb", "#7c3aed", "#0f766e", "#ea580c"] });
  const [layers, setLayers] = useState(initialLayers);
  const [selectedId, setSelectedId] = useState(() => null);
  const [exportType, setExportType] = useState("png");
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || "");
  const [status, setStatus] = useState("");
  const [smsTheme, setSmsTheme] = useState("light");
  const [phoneBuilderOpen, setPhoneBuilderOpen] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState({
    sender: "BroCode Support",
    status: "online",
    phoneTime: "9:41",
    dateLabel: "Today",
    headerColor: "#075e54",
    wallpaper1: "#e8f1ed",
    wallpaper2: "#d7e7e1",
    incomingColor: "#ffffff",
    outgoingColor: "#d9fdd3",
  });
  const [phoneMessages, setPhoneMessages] = useState([
    { id: id(), direction: "incoming", text: "Hello! Your plan details are ready. How can we help you today?", time: "9:38 AM" },
    { id: id(), direction: "outgoing", text: "Please share the latest plan and return details.", time: "9:39 AM" },
    { id: id(), direction: "incoming", text: "Sure. You can review every detail inside the BroCode app.", time: "9:40 AM" },
  ]);
  const selected = useMemo(() => layers.find((layer) => layer.id === selectedId) || null, [layers, selectedId]);

  useEffect(() => {
    if (!selectedId && layers.length) setSelectedId(layers[layers.length - 1].id);
  }, [layers, selectedId]);
  useEffect(() => {
    if (!selectedPlanId && plans.length) setSelectedPlanId(plans[0].id);
  }, [plans, selectedPlanId]);

  const renderCanvas = async (hideSelection = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (background.type === "transparent") ctx.clearRect(0, 0, canvas.width, canvas.height);
    else if (background.type === "solid") {
      ctx.fillStyle = background.color1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const radians = (background.angle * Math.PI) / 180;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const length = Math.abs(canvas.width * Math.cos(radians)) + Math.abs(canvas.height * Math.sin(radians));
      const gradient = ctx.createLinearGradient(
        centerX - Math.cos(radians) * length / 2,
        centerY - Math.sin(radians) * length / 2,
        centerX + Math.cos(radians) * length / 2,
        centerY + Math.sin(radians) * length / 2,
      );
      gradient.addColorStop(0, background.color1);
      gradient.addColorStop(1, background.color2);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (columns.count > 1) {
      const totalGap = columns.gap * (columns.count - 1);
      const width = (canvas.width - totalGap) / columns.count;
      for (let index = 0; index < columns.count; index += 1) {
        ctx.fillStyle = hexToRgba(columns.colors[index], columns.opacity);
        ctx.fillRect(index * (width + columns.gap), 0, width, canvas.height);
      }
    }

    for (const layer of layers) {
      if (layer.hidden) continue;
      ctx.save();
      ctx.globalAlpha = clamp(layer.opacity, 0, 1);
      const centerX = layer.x + layer.w / 2;
      const centerY = layer.y + layer.h / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((Number(layer.rotation || 0) * Math.PI) / 180);
      ctx.translate(-layer.w / 2, -layer.h / 2);
      if (layer.shadow) {
        ctx.shadowColor = "rgba(15, 23, 42, .3)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 10;
      }
      if (layer.type === "text") {
        ctx.fillStyle = layer.fill;
        ctx.font = `${layer.fontWeight || 400} ${layer.fontSize}px "${layer.fontFamily || "Inter"}", sans-serif`;
        ctx.textAlign = layer.align || "left";
        ctx.textBaseline = "top";
        drawWrappedText(ctx, layer);
      } else if (layer.type === "image") {
        let image = imageCache.current.get(layer.src);
        if (!image) {
          try {
            image = await loadImage(layer.src);
            imageCache.current.set(layer.src, image);
          } catch {
            image = null;
          }
        }
        if (image) {
          ctx.filter = `brightness(${layer.brightness || 100}%) contrast(${layer.contrast || 100}%) saturate(${layer.saturation || 100}%)`;
          ctx.drawImage(image, 0, 0, layer.w, layer.h);
          ctx.filter = "none";
        }
      } else {
        ctx.fillStyle = layer.fill;
        ctx.strokeStyle = layer.stroke || "transparent";
        ctx.lineWidth = Number(layer.strokeWidth || 0);
        if (layer.type === "circle") {
          ctx.beginPath();
          ctx.ellipse(layer.w / 2, layer.h / 2, layer.w / 2, layer.h / 2, 0, 0, Math.PI * 2);
        } else roundedRect(ctx, 0, 0, layer.w, layer.h, Number(layer.radius || 0));
        ctx.fill();
        if (layer.strokeWidth > 0) ctx.stroke();
      }
      ctx.restore();
    }

    if (selected && !hideSelection) {
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = Math.max(2, canvas.width / 600);
      ctx.setLineDash([10, 7]);
      ctx.strokeRect(selected.x, selected.y, selected.w, selected.h);
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0284c7";
      [[selected.x, selected.y], [selected.x + selected.w, selected.y], [selected.x, selected.y + selected.h], [selected.x + selected.w, selected.y + selected.h]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }
  };

  useEffect(() => {
    renderCanvas();
  }, [canvasSize, background, columns, layers, selectedId]);

  const updateSelected = (key, value) => setLayers((current) => current.map((layer) => layer.id === selectedId ? { ...layer, [key]: value } : layer));
  const addLayer = (type) => {
    const layer = newLayer(type, canvasSize.width, canvasSize.height);
    setLayers((current) => [...current, layer]);
    setSelectedId(layer.id);
  };
  const addImageFile = (file, fullCanvas = false, placement = "") => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result);
      let image;
      try { image = await loadImage(src); } catch { return; }
      const messageLogo = placement === "message-logo";
      const maxWidth = messageLogo ? Math.min(120, canvasSize.width * 0.24) : fullCanvas ? canvasSize.width : canvasSize.width * 0.55;
      const maxHeight = messageLogo ? Math.min(120, canvasSize.height * 0.12) : fullCanvas ? canvasSize.height : canvasSize.height * 0.55;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const w = Math.round(image.width * scale);
      const h = Math.round(image.height * scale);
      const layer = {
        id: id(),
        type: "image",
        name: messageLogo ? "Message logo" : file.name.replace(/\.[^.]+$/, "") || "Uploaded image",
        src,
        x: messageLogo ? Math.round(canvasSize.width - w - 55) : fullCanvas ? Math.round((canvasSize.width - w) / 2) : Math.round(canvasSize.width * 0.225),
        y: messageLogo ? Math.round(canvasSize.height * 0.72) : fullCanvas ? Math.round((canvasSize.height - h) / 2) : Math.round(canvasSize.height * 0.225),
        w,
        h,
        opacity: 1,
        rotation: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        shadow: false,
      };
      if (fullCanvas) setLayers([layer]);
      else setLayers((current) => [...current, layer]);
      setSelectedId(layer.id);
    };
    reader.readAsDataURL(file);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: id(), name: `${selected.name} copy`, x: selected.x + 24, y: selected.y + 24 };
    setLayers((current) => [...current, copy]);
    setSelectedId(copy.id);
  };
  const removeSelected = () => {
    if (!selected) return;
    const index = layers.findIndex((layer) => layer.id === selected.id);
    const remaining = layers.filter((layer) => layer.id !== selected.id);
    setLayers(remaining);
    setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id || null);
  };
  const moveSelected = (direction) => {
    const index = layers.findIndex((layer) => layer.id === selectedId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= layers.length) return;
    const reordered = [...layers];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setLayers(reordered);
  };

  const pointFromEvent = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvasSize.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvasSize.height / bounds.height),
    };
  };
  const onPointerDown = (event) => {
    const point = pointFromEvent(event);
    const bounds = canvasRef.current.getBoundingClientRect();
    const handleRadius = 18 * (canvasSize.width / Math.max(1, bounds.width));
    if (selected) {
      const handles = [
        ["nw", selected.x, selected.y],
        ["ne", selected.x + selected.w, selected.y],
        ["sw", selected.x, selected.y + selected.h],
        ["se", selected.x + selected.w, selected.y + selected.h],
      ];
      const handle = handles.find(([, x, y]) => Math.hypot(point.x - x, point.y - y) <= handleRadius);
      if (handle) {
        dragRef.current = {
          id: selected.id,
          mode: "resize",
          corner: handle[0],
          startX: point.x,
          startY: point.y,
          originX: selected.x,
          originY: selected.y,
          originW: selected.w,
          originH: selected.h,
        };
        canvasRef.current.setPointerCapture?.(event.pointerId);
        return;
      }
    }
    const hit = [...layers].reverse().find((layer) => !layer.hidden && point.x >= layer.x && point.x <= layer.x + layer.w && point.y >= layer.y && point.y <= layer.y + layer.h);
    if (!hit) return setSelectedId(null);
    setSelectedId(hit.id);
    dragRef.current = { id: hit.id, mode: "move", startX: point.x, startY: point.y, originX: hit.x, originY: hit.y };
    canvasRef.current.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    const point = pointFromEvent(event);
    const drag = dragRef.current;
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    setLayers((current) => current.map((layer) => {
      if (layer.id !== drag.id) return layer;
      if (drag.mode !== "resize") return {
        ...layer,
        x: Math.round(clamp(drag.originX + dx, -layer.w + 20, canvasSize.width - 20)),
        y: Math.round(clamp(drag.originY + dy, -layer.h + 20, canvasSize.height - 20)),
      };
      const fromLeft = drag.corner.includes("w");
      const fromTop = drag.corner.includes("n");
      const nextW = Math.max(10, drag.originW + (fromLeft ? -dx : dx));
      const nextH = Math.max(10, drag.originH + (fromTop ? -dy : dy));
      return {
        ...layer,
        x: Math.round(fromLeft ? drag.originX + drag.originW - nextW : drag.originX),
        y: Math.round(fromTop ? drag.originY + drag.originH - nextH : drag.originY),
        w: Math.round(nextW),
        h: Math.round(nextH),
      };
    }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const resetStudio = () => {
    setCanvasSize({ width: 1200, height: 675 });
    setBackground({ type: "gradient", color1: "#071b4b", color2: "#2563eb", angle: 135 });
    setColumns({ count: 2, gap: 24, opacity: 0.18, colors: ["#2563eb", "#7c3aed", "#0f766e", "#ea580c"] });
    const fresh = initialLayers();
    setLayers(fresh);
    setSelectedId(fresh[fresh.length - 1].id);
    setStatus("Studio reset.");
  };
  const generatePlanTemplate = () => {
    const plan = plans.find((item) => item.id === selectedPlanId) || plans[0];
    const title = plan?.name || "Featured Investment Plan";
    const returnValue = plan?.total_return ? `₹${Number(plan.total_return).toLocaleString("en-IN")}` : "COMING SOON";
    const duration = plan ? `${plan.days} ${plan.duration_unit === "hours" ? "Hour" : "Day"}${Number(plan.days) === 1 ? "" : "s"}` : "Flexible duration";
    const fresh = initialLayers();
    fresh[0].text = title;
    fresh[1].text = `${duration} • Secure access • Simple tracking`;
    fresh[3].text = returnValue;
    fresh[4].text = plan?.total_return ? "TOTAL RETURN" : "NEW OFFER";
    setLayers(fresh);
    setSelectedId(fresh[0].id);
    setStatus("Plan template generated. Every layer is editable.");
  };
  const updatePhoneMessage = (messageId, key, value) => setPhoneMessages((current) => current.map((message) => message.id === messageId ? { ...message, [key]: value } : message));
  const addPhoneMessage = (direction) => setPhoneMessages((current) => [...current, { id: id(), direction, text: direction === "incoming" ? "New received message" : "New sent message", time: phoneDraft.phoneTime }]);
  const removePhoneMessage = (messageId) => setPhoneMessages((current) => current.filter((message) => message.id !== messageId));
  const generatePhoneMessageTemplate = () => {
    const width = 1080;
    const height = 1920;
    const nextLayers = [];
    const pushRect = (name, x, y, w, h, fill, radius = 0, shadow = false) => nextLayers.push({ id: id(), type: "rect", name, x, y, w, h, fill, stroke: fill, strokeWidth: 0, radius, opacity: 1, rotation: 0, shadow });
    const pushText = (name, text, x, y, w, h, fill, fontSize, fontWeight = 500, align = "left") => nextLayers.push({ id: id(), type: "text", name, text, x, y, w, h, fill, fontSize, fontWeight, fontFamily: "Inter", align, opacity: 1, rotation: 0, shadow: false });

    pushRect("Phone status bar", 0, 0, width, 92, phoneDraft.headerColor);
    pushText("Phone time", phoneDraft.phoneTime, 42, 24, 180, 48, "#ffffff", 34, 700);
    pushText("Network and battery", "5G   ▮▮▮   92%", 740, 24, 290, 48, "#ffffff", 29, 650, "right");
    pushRect("Message header", 0, 90, width, 188, phoneDraft.headerColor);
    pushText("Back button", "‹", 24, 124, 55, 90, "#ffffff", 70, 400);
    pushRect("Profile photo area", 88, 126, 112, 112, "#ffffff", 999, true);
    pushText("Profile initial", (phoneDraft.sender.trim()[0] || "M").toUpperCase(), 88, 139, 112, 90, phoneDraft.headerColor, 56, 800, "center");
    pushText("Sender name", phoneDraft.sender || "Sender name", 230, 126, 650, 64, "#ffffff", 42, 750);
    pushText("Sender status", phoneDraft.status || "online", 232, 190, 520, 42, "#d1fae5", 26, 500);
    pushText("Call controls", "⌕   ⋮", 865, 138, 165, 70, "#ffffff", 45, 600, "right");
    pushRect("Date label background", 405, 314, 270, 68, "#ffffff", 28, true);
    pushText("Date label", phoneDraft.dateLabel || "Today", 425, 327, 230, 42, "#475569", 25, 700, "center");

    let y = 420;
    phoneMessages.forEach((message, index) => {
      const estimatedLines = Math.max(1, Math.ceil(String(message.text || "").length / 32));
      const bubbleHeight = clamp(92 + estimatedLines * 38, 130, 350);
      const bubbleWidth = clamp(470 + Math.min(String(message.text || "").length, 45) * 5, 570, 790);
      const incoming = message.direction === "incoming";
      const x = incoming ? 44 : width - bubbleWidth - 44;
      const fill = incoming ? phoneDraft.incomingColor : phoneDraft.outgoingColor;
      pushRect(`${incoming ? "Received" : "Sent"} bubble ${index + 1}`, x, y, bubbleWidth, bubbleHeight, fill, 28, true);
      pushText(`${incoming ? "Received" : "Sent"} message ${index + 1}`, message.text || "Edit message", x + 28, y + 22, bubbleWidth - 56, bubbleHeight - 66, "#172033", 31, 500);
      pushText(`Message time ${index + 1}`, message.time || phoneDraft.phoneTime, x + bubbleWidth - 185, y + bubbleHeight - 43, 155, 29, "#64748b", 20, 500, "right");
      y += bubbleHeight + 30;
    });

    pushRect("Message composer", 28, 1746, 900, 126, "#ffffff", 63, true);
    pushText("Emoji button", "☺", 55, 1771, 65, 64, "#64748b", 48, 500, "center");
    pushText("Message placeholder", "Message", 145, 1785, 480, 52, "#94a3b8", 32, 500);
    pushText("Attachment controls", "＋   ◉", 690, 1781, 190, 58, "#64748b", 38, 600, "right");
    pushRect("Send button", 948, 1758, 104, 104, phoneDraft.headerColor, 999, true);
    pushText("Send arrow", "➤", 965, 1777, 70, 62, "#ffffff", 39, 700, "center");

    setCanvasSize({ width, height });
    setBackground({ type: "gradient", color1: phoneDraft.wallpaper1, color2: phoneDraft.wallpaper2, angle: 135 });
    setColumns((current) => ({ ...current, count: 1, opacity: 0 }));
    setLayers(nextLayers);
    setSelectedId(nextLayers.find((layer) => layer.name === "Sender name")?.id || nextLayers[0]?.id);
    setPhoneBuilderOpen(false);
    setStatus("Phone message screen generated. Every item is now a separate editable layer.");
  };
  const generateSmsScreenshotTemplate = (themeKey = smsTheme) => {
    const width = 587;
    const height = 1280;
    const theme = SMS_THEMES[themeKey] || SMS_THEMES.light;
    const nextLayers = [];
    const pushRect = (name, x, y, w, h, fill, radius = 0, shadow = false) => nextLayers.push({ id: id(), type: "rect", name, x, y, w, h, fill, stroke: fill, strokeWidth: 0, radius, opacity: 1, rotation: 0, shadow });
    const pushCircle = (name, x, y, w, h, fill) => nextLayers.push({ id: id(), type: "circle", name, x, y, w, h, fill, stroke: fill, strokeWidth: 0, radius: 999, opacity: 1, rotation: 0, shadow: false });
    const pushText = (name, text, x, y, w, h, fill, fontSize, fontWeight = 500, align = "left") => nextLayers.push({ id: id(), type: "text", name, text, x, y, w, h, fill, fontSize, fontWeight, fontFamily: "Arial", align, opacity: 1, rotation: 0, shadow: false });

    pushRect("Status bar background", 0, 0, width, 58, theme.top);
    pushText("Phone time", "10:11", 34, 18, 105, 34, theme.text, 22, 700);
    pushText("Network labels", "Vo  5G", 387, 20, 65, 28, theme.text, 11, 700);
    pushText("Signal bars", "▮▮▮  ▮▮▮", 429, 18, 92, 30, theme.text, 18, 700);
    pushText("Battery percent", "▮ 27%", 500, 18, 72, 30, theme.text, 20, 700, "right");

    pushRect("Conversation header", 0, 58, width, 106, theme.top);
    pushText("Back button", "‹", 27, 79, 55, 64, theme.text, 57, 400);
    pushCircle("Profile background", 95, 70, 68, 68, theme.avatar);
    pushCircle("Profile head", 117, 86, 24, 24, "#ffffff");
    pushCircle("Profile shoulders", 108, 110, 42, 20, "#ffffff");
    pushText("Sender name", "AD-MONFRT-S", 182, 91, 315, 54, theme.text, 29, 400);
    pushText("More menu", "⋮", 519, 84, 37, 58, theme.text, 42, 700, "center");

    pushRect("Message area", 0, 158, width, 630, theme.screen, 42);
    pushRect("Unread line left", 14, 789, 243, 2, theme.accent);
    pushRect("Unread line right", 333, 789, 241, 2, theme.accent);
    pushRect("Unread label background", 253, 770, 83, 42, theme.screen);
    pushText("Unread label", "Unread", 255, 779, 78, 32, theme.accent, 20, 400, "center");
    pushText("Conversation date", "Monday • 2:44 pm", 180, 822, 226, 34, theme.muted, 20, 400, "center");

    pushRect("SMS message bubble", 14, 868, 513, 222, theme.bubble, 32);
    pushText("SMS main text", "DearYouareherebyinformed {2600}\nDear {MAST79} Member, your reward\nis now available. Log in and check your", 39, 888, 465, 116, theme.text, 25, 400);
    pushText("Inbox label", "inbox:", 39, 1008, 70, 40, theme.text, 25, 400);
    pushText("SMS link", "cutt.ly/4yr29Y1b", 108, 1008, 230, 40, theme.text, 25, 400);
    nextLayers[nextLayers.length - 1].underline = true;
    pushText("SMS signature", "PrincipalMONFRT", 39, 1048, 250, 40, theme.text, 25, 400);
    pushText("Message time", "2:44 pm", 39, 1101, 118, 32, theme.muted, 19, 400);

    pushRect("No reply information box", 14, 1137, 559, 143, theme.bubble, 38);
    pushText("No reply information", "Sender can't accept replies. Contact\nthem directly.", 48, 1174, 492, 73, theme.text, 25, 400);
    pushText("Learn more link", "Learn more", 215, 1215, 155, 40, theme.accent, 25, 400);
    nextLayers[nextLayers.length - 1].underline = true;

    setCanvasSize({ width, height });
    setSmsTheme(themeKey);
    setBackground({ type: "solid", color1: theme.screen, color2: theme.screen, angle: 0 });
    setColumns((current) => ({ ...current, count: 1, opacity: 0 }));
    setLayers(nextLayers);
    setSelectedId(nextLayers.find((layer) => layer.name === "Sender name")?.id || nextLayers[0]?.id);
    setPhoneBuilderOpen(false);
    setStatus(`${theme.label} SMS template opened at the exact 587 × 1280 size. Background, bubbles, logo and every marked area are editable.`);
  };
  const saveStudioTemplate = () => {
    try {
      localStorage.setItem(STUDIO_TEMPLATE_KEY, JSON.stringify({ canvasSize, background, columns, layers }));
      setStatus("Current design saved on this device. Use “Load saved” to reopen it.");
    } catch {
      setStatus("This design is too large to save in the browser. Remove large uploaded images and try again.");
    }
  };
  const loadSavedTemplate = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STUDIO_TEMPLATE_KEY) || "null");
      if (!saved?.canvasSize || !Array.isArray(saved.layers)) return setStatus("No custom saved template found yet.");
      setCanvasSize(saved.canvasSize);
      setBackground(saved.background);
      setColumns(saved.columns);
      setLayers(saved.layers);
      setSelectedId(saved.layers[0]?.id || null);
      setStatus("Saved template loaded.");
    } catch {
      setStatus("Saved template could not be opened.");
    }
  };
  const exportCanvas = async (applyToPlan = false) => {
    setSelectedId(null);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await renderCanvas(true);
    const config = EXPORT_TYPES[exportType];
    const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, config.mime, config.quality));
    if (!blob) return;
    if (applyToPlan) {
      if (!selectedPlanId || !onApplyToPlan) return setStatus("Choose a plan first.");
      const file = new File([blob], `plan-banner-${selectedPlanId}.${config.extension}`, { type: config.mime });
      await onApplyToPlan(selectedPlanId, file);
      setStatus("Generated banner sent to the selected plan.");
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `meta-money-design-${Date.now()}.${config.extension}`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`${config.extension.toUpperCase()} downloaded.`);
    }
  };

  const alignIcon = selected?.align === "center" ? <AlignCenter /> : selected?.align === "right" ? <AlignRight /> : <AlignLeft />;

  return <div className="admin-image-studio">
    <header className="image-studio-hero">
      <div><span><Sparkles /> Creative tools</span><h2>Image Studio</h2><p>Generate plan banners and edit every layer, color, area and column before exporting.</p></div>
      <div className="image-studio-hero-actions"><button type="button" onClick={() => generateSmsScreenshotTemplate()}><MessageCircle /> SMS screenshot</button><button type="button" onClick={() => setPhoneBuilderOpen((current) => !current)}><Smartphone /> Phone message</button><button type="button" onClick={generatePlanTemplate}><Sparkles /> Plan template</button><button type="button" onClick={resetStudio}><RotateCcw /> Reset</button></div>
    </header>

    <div className="image-studio-toolbar">
      <button type="button" className={phoneBuilderOpen ? "active" : ""} onClick={() => setPhoneBuilderOpen((current) => !current)}><MessageCircle /> Message screen</button>
      <button type="button" onClick={() => generateSmsScreenshotTemplate()}><Smartphone /> Saved SMS template</button>
      <button type="button" onClick={() => addLayer("text")}><Type /> Text</button>
      <button type="button" onClick={() => addLayer("rect")}><RectangleHorizontal /> Rectangle</button>
      <button type="button" onClick={() => addLayer("circle")}><Circle /> Circle</button>
      <button type="button" onClick={() => fileInputRef.current?.click()}><ImageIcon /> Add image / logo</button>
      <button type="button" onClick={() => messageLogoInputRef.current?.click()}><ImageIcon /> Logo in message</button>
      <button type="button" onClick={() => baseImageInputRef.current?.click()}><UploadCloud /> Edit base image</button>
      <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={(event) => { addImageFile(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={messageLogoInputRef} hidden type="file" accept="image/*" onChange={(event) => { addImageFile(event.target.files?.[0], false, "message-logo"); event.target.value = ""; }} />
      <input ref={baseImageInputRef} hidden type="file" accept="image/*" onChange={(event) => { addImageFile(event.target.files?.[0], true); event.target.value = ""; }} />
      <label className="image-studio-theme-select"><span>Theme</span><select value={smsTheme} onChange={(event) => generateSmsScreenshotTemplate(event.target.value)}>{Object.entries(SMS_THEMES).map(([value, theme]) => <option key={value} value={value}>{theme.label}</option>)}</select></label>
      <span className="image-studio-toolbar-spacer" />
      <button type="button" onClick={saveStudioTemplate}><Save /> Save template</button>
      <button type="button" onClick={loadSavedTemplate}><FolderOpen /> Load saved</button>
      <button type="button" disabled={!selected} onClick={duplicateSelected}><Copy /> Duplicate</button>
      <button type="button" disabled={!selected} onClick={removeSelected}><Trash2 /> Delete</button>
    </div>

    {phoneBuilderOpen ? <section className="phone-message-builder">
      <div className="phone-message-builder-heading"><div><span><Smartphone /> Phone message designer</span><h3>Edit the message screen before generating</h3><p>After generation, sender, profile area, status bar, every bubble, text, time, colors and input area remain separate editable layers. Add your logo with “Add image / logo”.</p></div><button type="button" onClick={generatePhoneMessageTemplate}><Sparkles /> Generate editable screen</button></div>
      <div className="phone-message-meta-grid">
        <label>Sender name<input value={phoneDraft.sender} onChange={(event) => setPhoneDraft((current) => ({ ...current, sender: event.target.value }))} /></label>
        <label>Status text<input value={phoneDraft.status} onChange={(event) => setPhoneDraft((current) => ({ ...current, status: event.target.value }))} /></label>
        <label>Phone time<input value={phoneDraft.phoneTime} onChange={(event) => setPhoneDraft((current) => ({ ...current, phoneTime: event.target.value }))} /></label>
        <label>Date label<input value={phoneDraft.dateLabel} onChange={(event) => setPhoneDraft((current) => ({ ...current, dateLabel: event.target.value }))} /></label>
      </div>
      <div className="phone-message-color-grid">
        {[["headerColor", "Header"], ["wallpaper1", "Wallpaper 1"], ["wallpaper2", "Wallpaper 2"], ["incomingColor", "Received bubble"], ["outgoingColor", "Sent bubble"]].map(([key, label]) => <label key={key}>{label}<input type="color" value={phoneDraft[key]} onChange={(event) => setPhoneDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
      </div>
      <div className="phone-message-list">
        <div className="phone-message-list-heading"><b>Messages</b><div><button type="button" onClick={() => addPhoneMessage("incoming")}><Plus /> Received</button><button type="button" onClick={() => addPhoneMessage("outgoing")}><Plus /> Sent</button></div></div>
        {phoneMessages.map((message, index) => <div className={`phone-message-row ${message.direction}`} key={message.id}>
          <span>{index + 1}</span>
          <select value={message.direction} onChange={(event) => updatePhoneMessage(message.id, "direction", event.target.value)} aria-label={`Message ${index + 1} direction`}><option value="incoming">Received</option><option value="outgoing">Sent</option></select>
          <textarea value={message.text} onChange={(event) => updatePhoneMessage(message.id, "text", event.target.value)} aria-label={`Message ${index + 1} text`} />
          <input value={message.time} onChange={(event) => updatePhoneMessage(message.id, "time", event.target.value)} aria-label={`Message ${index + 1} time`} />
          <button type="button" onClick={() => removePhoneMessage(message.id)} aria-label={`Delete message ${index + 1}`}><Trash2 /></button>
        </div>)}
      </div>
    </section> : null}

    <div className="image-studio-workspace">
      <aside className="image-studio-panel image-studio-document">
        <h3>Document</h3>
        <label>Canvas preset<select value={`${canvasSize.width}x${canvasSize.height}`} onChange={(event) => { const [width, height] = event.target.value.split("x").map(Number); setCanvasSize({ width, height }); }}><option value={`${canvasSize.width}x${canvasSize.height}`}>Custom ({canvasSize.width} × {canvasSize.height})</option>{CANVAS_PRESETS.filter(([, width, height]) => width !== canvasSize.width || height !== canvasSize.height).map(([label, width, height]) => <option key={label} value={`${width}x${height}`}>{label} ({width} × {height})</option>)}</select></label>
        <div className="image-studio-two-fields"><label>Width<input type="number" min="320" max="4000" value={canvasSize.width} onChange={(event) => setCanvasSize((current) => ({ ...current, width: clamp(event.target.value, 320, 4000) }))} /></label><label>Height<input type="number" min="320" max="4000" value={canvasSize.height} onChange={(event) => setCanvasSize((current) => ({ ...current, height: clamp(event.target.value, 320, 4000) }))} /></label></div>
        <label>Background<select value={background.type} onChange={(event) => setBackground((current) => ({ ...current, type: event.target.value }))}><option value="gradient">Gradient</option><option value="solid">Solid color</option><option value="transparent">Transparent</option></select></label>
        {background.type !== "transparent" ? <div className="image-studio-color-row"><label>Color 1<input type="color" value={background.color1} onChange={(event) => setBackground((current) => ({ ...current, color1: event.target.value }))} /></label>{background.type === "gradient" ? <label>Color 2<input type="color" value={background.color2} onChange={(event) => setBackground((current) => ({ ...current, color2: event.target.value }))} /></label> : null}</div> : null}
        {background.type === "gradient" ? <label>Gradient angle <output>{background.angle}°</output><input type="range" min="0" max="360" value={background.angle} onChange={(event) => setBackground((current) => ({ ...current, angle: Number(event.target.value) }))} /></label> : null}
        <div className="image-studio-divider" />
        <h3>Editable columns</h3>
        <div className="image-studio-two-fields"><label>Columns<input type="number" min="1" max="4" value={columns.count} onChange={(event) => setColumns((current) => ({ ...current, count: clamp(event.target.value, 1, 4) }))} /></label><label>Gap<input type="number" min="0" max="200" value={columns.gap} onChange={(event) => setColumns((current) => ({ ...current, gap: clamp(event.target.value, 0, 200) }))} /></label></div>
        <label>Column opacity <output>{Math.round(columns.opacity * 100)}%</output><input type="range" min="0" max="100" value={columns.opacity * 100} onChange={(event) => setColumns((current) => ({ ...current, opacity: Number(event.target.value) / 100 }))} /></label>
        <div className="image-studio-column-colors">{columns.colors.slice(0, columns.count).map((color, index) => <label key={index}>Column {index + 1}<input type="color" value={color} onChange={(event) => setColumns((current) => ({ ...current, colors: current.colors.map((item, colorIndex) => colorIndex === index ? event.target.value : item) }))} /></label>)}</div>
      </aside>

      <main className="image-studio-stage">
        <div className="image-studio-canvas-shell" style={{ aspectRatio: `${canvasSize.width}/${canvasSize.height}`, width: `min(100%, ${(68 * canvasSize.width) / canvasSize.height}vh)` }}>
          <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="Editable image canvas" />
        </div>
        <div className="image-studio-stage-meta"><span>{canvasSize.width} × {canvasSize.height}px • Ratio locked</span><span>Drag to move • Drag white corner handles to resize</span></div>
      </main>

      <aside className="image-studio-panel image-studio-properties">
        <h3>{selected ? selected.name : "Layer properties"}</h3>
        {!selected ? <div className="image-studio-empty"><Layers3 /><p>Select a layer on the canvas or in the layer list to edit it.</p></div> : <>
          <label>Layer name<input value={selected.name} onChange={(event) => updateSelected("name", event.target.value)} /></label>
          {selected.type === "text" ? <>
            <label>Text<textarea value={selected.text} onChange={(event) => updateSelected("text", event.target.value)} /></label>
            <div className="image-studio-two-fields"><label>Font size<input type="number" min="8" max="400" value={selected.fontSize} onChange={(event) => updateSelected("fontSize", clamp(event.target.value, 8, 400))} /></label><label>Weight<select value={selected.fontWeight} onChange={(event) => updateSelected("fontWeight", Number(event.target.value))}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option><option value="900">Black</option></select></label></div>
            <label>Font family<select value={selected.fontFamily} onChange={(event) => updateSelected("fontFamily", event.target.value)}>{FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}</select></label>
            <div className="image-studio-align"><span>Text alignment</span>{[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([value, Icon]) => <button key={value} type="button" className={selected.align === value ? "active" : ""} onClick={() => updateSelected("align", value)} aria-label={`Align ${value}`}><Icon /></button>)}</div>
            <label className="image-studio-check"><input type="checkbox" checked={Boolean(selected.underline)} onChange={(event) => updateSelected("underline", event.target.checked)} /> Underline text</label>
          </> : null}
          <div className="image-studio-two-fields"><label>X<input type="number" value={Math.round(selected.x)} onChange={(event) => updateSelected("x", Number(event.target.value))} /></label><label>Y<input type="number" value={Math.round(selected.y)} onChange={(event) => updateSelected("y", Number(event.target.value))} /></label></div>
          <div className="image-studio-two-fields"><label>Width<input type="number" min="10" value={Math.round(selected.w)} onChange={(event) => updateSelected("w", Math.max(10, Number(event.target.value)))} /></label><label>Height<input type="number" min="10" value={Math.round(selected.h)} onChange={(event) => updateSelected("h", Math.max(10, Number(event.target.value)))} /></label></div>
          {selected.type !== "image" ? <div className="image-studio-color-row"><label>{selected.type === "text" ? "Text color" : "Fill"}<input type="color" value={selected.fill} onChange={(event) => updateSelected("fill", event.target.value)} /></label>{selected.type !== "text" ? <label>Border<input type="color" value={selected.stroke || "#000000"} onChange={(event) => updateSelected("stroke", event.target.value)} /></label> : null}</div> : null}
          {selected.type === "rect" ? <div className="image-studio-two-fields"><label>Corner radius<input type="number" min="0" max="500" value={selected.radius || 0} onChange={(event) => updateSelected("radius", clamp(event.target.value, 0, 500))} /></label><label>Border width<input type="number" min="0" max="50" value={selected.strokeWidth || 0} onChange={(event) => updateSelected("strokeWidth", clamp(event.target.value, 0, 50))} /></label></div> : null}
          {selected.type === "circle" ? <label>Border width<input type="number" min="0" max="50" value={selected.strokeWidth || 0} onChange={(event) => updateSelected("strokeWidth", clamp(event.target.value, 0, 50))} /></label> : null}
          {selected.type === "image" ? <>
            <label>Brightness <output>{selected.brightness}%</output><input type="range" min="0" max="200" value={selected.brightness} onChange={(event) => updateSelected("brightness", Number(event.target.value))} /></label>
            <label>Contrast <output>{selected.contrast}%</output><input type="range" min="0" max="200" value={selected.contrast} onChange={(event) => updateSelected("contrast", Number(event.target.value))} /></label>
            <label>Saturation <output>{selected.saturation}%</output><input type="range" min="0" max="200" value={selected.saturation} onChange={(event) => updateSelected("saturation", Number(event.target.value))} /></label>
          </> : null}
          <label>Opacity <output>{Math.round(selected.opacity * 100)}%</output><input type="range" min="0" max="100" value={selected.opacity * 100} onChange={(event) => updateSelected("opacity", Number(event.target.value) / 100)} /></label>
          <label>Rotation <output>{selected.rotation}°</output><input type="range" min="-180" max="180" value={selected.rotation} onChange={(event) => updateSelected("rotation", Number(event.target.value))} /></label>
          <label className="image-studio-check"><input type="checkbox" checked={Boolean(selected.shadow)} onChange={(event) => updateSelected("shadow", event.target.checked)} /> Soft shadow</label>
          <div className="image-studio-layer-actions"><button type="button" onClick={() => moveSelected(1)}><ArrowUp /> Bring forward</button><button type="button" onClick={() => moveSelected(-1)}><ArrowDown /> Send backward</button></div>
          <div className="image-studio-selected-summary">{alignIcon}<span>{selected.type} layer • {Math.round(selected.w)} × {Math.round(selected.h)}</span></div>
        </>}
      </aside>
    </div>

    <div className="image-studio-bottom">
      <section className="image-studio-layers">
        <div className="image-studio-section-title"><div><Layers3 /><span><b>Layers</b><small>Top item appears in front</small></span></div><button type="button" onClick={() => addLayer("text")}><Plus /> Add</button></div>
        <div className="image-studio-layer-list">{[...layers].reverse().map((layer) => <button key={layer.id} type="button" className={selectedId === layer.id ? "active" : ""} onClick={() => setSelectedId(layer.id)}><span className={`image-studio-layer-icon ${layer.type}`}>{layer.type === "text" ? <Type /> : layer.type === "image" ? <ImageIcon /> : layer.type === "circle" ? <Circle /> : <RectangleHorizontal />}</span><span><b>{layer.name}</b><small>{layer.type} • {Math.round(layer.w)} × {Math.round(layer.h)}</small></span></button>)}</div>
      </section>

      <section className="image-studio-export">
        <div className="image-studio-section-title"><div><Download /><span><b>Export & publish</b><small>Download or use the design as a plan banner</small></span></div></div>
        <div className="image-studio-export-grid">
          <label>File type<select value={exportType} onChange={(event) => setExportType(event.target.value)}><option value="png">PNG — best quality</option><option value="jpeg">JPEG — smaller file</option><option value="webp">WebP — optimized</option></select></label>
          <button type="button" className="image-studio-download" onClick={() => exportCanvas(false)}><Download /> Download image</button>
          <label>Apply to plan<select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}><option value="">Choose a plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name || plan.id}</option>)}</select></label>
          <button type="button" className="image-studio-publish" disabled={busy || !selectedPlanId} onClick={() => exportCanvas(true)}><UploadCloud /> {busy ? "Applying…" : "Use as plan image"}</button>
        </div>
        {status ? <div className="image-studio-status">{status}</div> : null}
      </section>
    </div>
  </div>;
}
