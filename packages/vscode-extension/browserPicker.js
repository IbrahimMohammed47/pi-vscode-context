(() => {
  const marker = __PI_BROWSER_MARKER__;
  const existing = globalThis.__piBrowserElementPicker;
  if (existing?.active) {
    existing.stop();
    return "PI_BROWSER_PICKER_CANCELLED";
  }

  const root = document.createElement("div");
  const shadow = root.attachShadow({ mode: "closed" });
  const highlight = document.createElement("div");
  const label = document.createElement("div");
  root.style.cssText =
    "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  highlight.style.cssText =
    "position:fixed;display:none;box-sizing:border-box;border:2px solid #3794ff;background:rgba(55,148,255,.12);pointer-events:none";
  label.style.cssText =
    "position:fixed;display:none;max-width:70vw;padding:3px 6px;border-radius:3px;background:#1f1f1f;color:#fff;font:12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none";
  shadow.append(highlight, label);
  document.documentElement.append(root);

  const cssEscape = (value) =>
    globalThis.CSS?.escape
      ? CSS.escape(value)
      : String(value).replace(
          /[^a-zA-Z0-9_-]/g,
          (character) => `\\${character}`,
        );

  const segment = (element) => {
    const tag = element.localName;
    if (element.id) return `${tag}#${cssEscape(element.id)}`;
    const classes = [...element.classList].filter(Boolean).slice(0, 3);
    if (classes.length)
      return `${tag}${classes.map((name) => `.${cssEscape(name)}`).join("")}`;
    const parent = element.parentElement;
    if (!parent) return tag;
    const siblings = [...parent.children].filter(
      (child) => child.localName === tag,
    );
    return siblings.length > 1
      ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})`
      : tag;
  };

  const selector = (element) => {
    const parts = [];
    let current = element;
    while (
      current &&
      current.nodeType === Node.ELEMENT_NODE &&
      parts.length < 8
    ) {
      parts.unshift(segment(current));
      if (current.id) break;
      current = current.parentElement;
    }
    return parts.join(" > ");
  };

  const bounded = (value, length) => {
    const text = String(value ?? "");
    return text.length <= length ? text : `${text.slice(0, length)}…`;
  };

  const styleSnapshot = (element) => {
    const style = getComputedStyle(element);
    const properties = [
      "display",
      "position",
      "box-sizing",
      "width",
      "height",
      "margin",
      "padding",
      "gap",
      "overflow",
      "color",
      "background-color",
      "border",
      "border-radius",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "text-align",
      "opacity",
      "visibility",
      "flex",
      "flex-direction",
      "align-items",
      "justify-content",
      "grid-template-columns",
      "grid-template-rows",
      "z-index",
    ];
    return Object.fromEntries(
      properties.map((property) => [
        property,
        style.getPropertyValue(property),
      ]),
    );
  };

  const payloadFor = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      url: location.href,
      title: document.title,
      tagName: element.localName,
      selector: selector(element),
      text: bounded(element.textContent || "", 4096),
      outerHTML: bounded(element.outerHTML, 20480),
      attributes: Object.fromEntries(
        [...element.attributes]
          .slice(0, 20)
          .map(({ name, value }) => [name, bounded(value, 256)]),
      ),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      computedStyle: styleSnapshot(element),
    };
  };

  const copyPayload = async (payload) => {
    const text = marker + JSON.stringify(payload);
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:-10000px;top:-10000px";
    document.documentElement.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  let current;
  const move = (event) => {
    const element = event
      .composedPath()
      .find((candidate) => candidate instanceof Element && candidate !== root);
    if (!element) return;
    current = element;
    const rect = element.getBoundingClientRect();
    highlight.style.display = "block";
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    label.textContent = selector(element);
    label.style.display = "block";
    label.style.left = `${Math.max(0, rect.left)}px`;
    label.style.top = `${Math.max(0, rect.top - 24)}px`;
  };

  const stop = () => {
    document.removeEventListener("mousemove", move, true);
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", keydown, true);
    root.remove();
    delete globalThis.__piBrowserElementPicker;
  };

  const click = async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const element =
      current ??
      event
        .composedPath()
        .find(
          (candidate) => candidate instanceof Element && candidate !== root,
        );
    if (!element) return;
    const payload = payloadFor(element);
    stop();
    await copyPayload(payload);
  };

  const keydown = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stop();
  };

  document.addEventListener("mousemove", move, true);
  document.addEventListener("click", click, true);
  document.addEventListener("keydown", keydown, true);
  globalThis.__piBrowserElementPicker = { active: true, stop };
  return "PI_BROWSER_PICKER_ACTIVE";
})();
