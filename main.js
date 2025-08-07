const imageKeys = [
  "img",
  "image",
  "images",
  "imageUrl",
  "thumbnail",
  "avatar",
  "photo",
  "picture",
  "icon",
  "logo",
  "url",
  "src",
  "cover",
  "background",
];

const extractImages = (obj, depth = 0, set = new Set()) => {
  if (depth > 5 || typeof obj !== "object" || !obj) return;
  for (const [k, v] of Object.entries(obj)) {
    if (imageKeys.some((key) => k.toLowerCase().includes(key))) {
      if (
        typeof v === "string" &&
        (v.startsWith("http") || v.startsWith("data:"))
      )
        set.add(v);
      else if (Array.isArray(v))
        v.forEach(
          (s) =>
            typeof s === "string" &&
            (s.startsWith("http") || s.startsWith("data:")) &&
            set.add(s)
        );
    }
    if (typeof v === "object") extractImages(v, depth + 1, set);
  }
  return set;
};

const processImages = async (res) => {
  try {
    if (!res)
      throw new Error(
        "错误：响应体无效，无法处理图片预览。请检查请求是否正常返回。"
      );
    const body =
      typeof res.getBodyBuffer === "function"
        ? await res.getBodyBuffer()
        : typeof res.getBody === "function"
        ? await res.getBody()
        : res.body;
    const json = Buffer.isBuffer(body)
      ? JSON.parse(body.toString("utf8"))
      : typeof body === "string"
      ? JSON.parse(body)
      : typeof body === "object"
      ? body
      : (() => {
          throw new Error("错误：响应体格式不被支持，无法解析为 JSON 对象。");
        })();

    const images = Array.from(extractImages(json));
    if (!images.length) return null; // 没有图片则不处理

    const html = images
      .map((url, i) => {
        const showUrl = url.startsWith("data:")
          ? url.split(",")[0] + ",<base64数据>"
          : url;
        return `<div style="margin: 20px 0;">
          <div style="text-align: center;">
            <img src="${url}" alt="图片 ${i + 1}" class="preview-image"
              style="max-width: 100%; border: 1px solid #444; border-radius: 4px; margin: 5px auto; display: block; cursor: pointer; background: #222;"
              data-url="${url}" onerror="this.style.display='none'">
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #aaa; margin-top: 10px; padding: 8px 0; border-bottom: 1px solid #444;">
            <span style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; padding-right: 16px;">
            ${showUrl}
            </span>
            <button class="copy-url-btn" data-url="${url}" style="padding: 2px 8px; border: 1px solid #555; background: #333; color: #fff; border-radius: 3px; cursor: pointer; font-size: 12px;">复制</button>
          </div>
        </div>`;
      })
      .join("");

    return `<div style="font-family: system-ui;">
      <div style="text-align: center; color: #a4e5a9; background: #2e4d30; padding: 10px; border-radius: 4px; margin-bottom: 20px;">
        共检测到 ${images.length} 张图片
      </div>
      ${html}
    </div>
    <style>
      #image-zoom-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 1000000; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
      #image-zoom-overlay img { max-width: 90vw; max-height: 90vh; box-shadow: 0 0 20px rgba(0,0,0,0.5); border-radius: 6px; background: white; transition: transform 0.2s ease; user-select: none; pointer-events: none; }
    </style>`;
  } catch (err) {
    console.error("处理响应体时发生错误：", err);
    return '<div style="color: red; text-align: center;">处理响应体时出错，请检查控制台日志。</div>';
  }
};

const createPreviewWindow = (result) => {
  try {
    let box = document.getElementById("image-preview-container");
    if (!box) {
      box = document.createElement("div");
      box.id = "image-preview-container";
      box.style.cssText = `position: fixed; top: 0; right: 0; bottom: 0; width: 400px; background: rgba(26,26,26,0.75); backdrop-filter: blur(10px); z-index: 999999; overflow-y: auto; padding: 20px; font-family: system-ui; color: #fff;`;
      document.body.appendChild(box);
    }
    box.innerHTML = `
      <div style="position: sticky; top: 0; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <button id="close-preview-btn" style="float: right; padding: 3px 8px; border: none; background: #f44336; color: white; border-radius: 4px; cursor: pointer;">关闭</button>
        <h3 style="margin: 0; color: #fff;">🖼️ 图片预览</h3>
      </div>${result}`;

    box
      .querySelector("#close-preview-btn")
      ?.addEventListener("click", () => box.remove());
    box.querySelectorAll(".copy-url-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const url = btn.dataset.url;
        try {
          await navigator.clipboard.writeText(url);
          btn.textContent = "已复制";
          btn.style.background = "#e8f5e9";
          btn.style.color = "#2e7d32";
          btn.style.borderColor = "#2e7d32";
          setTimeout(() => {
            btn.textContent = "复制";
            btn.style =
              "padding: 2px 8px; border: 1px solid #555; background: #333; color: #fff; border-radius: 3px; cursor: pointer; font-size: 12px;";
          }, 2000);
        } catch {
          btn.textContent = "复制失败";
          btn.style.background = "#ffebee";
          btn.style.color = "#c62828";
          btn.style.borderColor = "#c62828";
        }
      })
    );
    box.querySelectorAll(".preview-image").forEach((img) => {
      img.addEventListener("click", () => {
        document.getElementById("image-zoom-overlay")?.remove();
        const overlay = document.createElement("div");
        overlay.id = "image-zoom-overlay";
        const big = document.createElement("img");
        big.src = img.dataset.url;
        let scale = 1;
        overlay.addEventListener(
          "wheel",
          (e) => {
            e.preventDefault();
            scale += e.deltaY < 0 ? 0.1 : -0.1;
            scale = Math.min(Math.max(0.5, scale), 5);
            big.style.transform = `scale(${scale})`;
          },
          { passive: false }
        );
        overlay.addEventListener("click", () => overlay.remove());
        overlay.appendChild(big);
        document.body.appendChild(overlay);
      });
    });
  } catch (e) {
    const msg = `创建预览窗口时发生错误：${e.message || e}`;
    console.error(msg);
    alert(msg);
  }
};

module.exports = {
  responseHooks: [
    async ({ response }) => {
      if (!response.getHeader("content-type")?.includes("application/json"))
        return;
      try {
        const html = await processImages(response);
        if (html) setTimeout(() => createPreviewWindow(html), 100);
      } catch (e) {
        console.error("响应钩子处理图片时出错：", e);
      }
    },
  ],
};
