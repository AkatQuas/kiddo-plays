let minioConfig = null;

async function loadConfig() {
  const res = await fetch("/api/config");
  const json = await res.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "加载配置失败");
  }
  minioConfig = json.data;
}

function getUsername() {
  const value = document.getElementById("username").value.trim();
  if (!value) {
    throw new Error("请输入用户名");
  }
  return value;
}

function setStatus(text, type) {
  const el = document.getElementById("upload-status");
  el.hidden = false;
  el.textContent = text;
  el.className = `status ${type}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleString("zh-CN");
}

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function resolveContentType(file) {
  if (file.type) {
    if (file.type.startsWith("text/") && !file.type.includes("charset")) {
      return `${file.type}; charset=utf-8`;
    }
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (/\.(txt|md|csv|log|xml|html|css|js|json)$/.test(name)) {
    return "text/plain; charset=utf-8";
  }
  return "application/octet-stream";
}

async function downloadFile(url, fileName) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败 (${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

async function uploadToMinio(file, username) {
  const fileKey = `${username}/${randomId()}_${file.name}`;
  const url = `${minioConfig.minio_endpoint}/${minioConfig.minio_bucket}/${fileKey}`;
  const contentType = resolveContentType(file);

  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!res.ok) {
    throw new Error(`MinIO 上传失败 (${res.status})`);
  }

  return {
    file_key: fileKey,
    file_url: url,
    file_size: file.size,
    mime_type: file.type || contentType.split(";")[0].trim() || null,
  };
}

async function bindFile(username, file, uploadResult) {
  const res = await fetch("/api/file/bind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      file_name: file.name,
      file_key: uploadResult.file_key,
      file_url: uploadResult.file_url,
      file_size: uploadResult.file_size,
      mime_type: uploadResult.mime_type,
    }),
  });
  const json = await res.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "元数据绑定失败");
  }
  return json.data;
}

async function handleUpload() {
  const fileInput = document.getElementById("file-input");
  const uploadBtn = document.getElementById("upload-btn");
  const file = fileInput.files[0];

  try {
    const username = getUsername();
    if (!file) {
      throw new Error("请选择文件");
    }

    uploadBtn.disabled = true;
    setStatus("正在上传至 MinIO…", "info");

    const uploadResult = await uploadToMinio(file, username);
    setStatus("上传成功，正在绑定元数据…", "info");

    await bindFile(username, file, uploadResult);
    setStatus("文件上传绑定完成", "success");
    fileInput.value = "";
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    uploadBtn.disabled = false;
  }
}

async function handleQuery() {
  const listEl = document.getElementById("file-list");
  const emptyTip = document.getElementById("empty-tip");

  try {
    const username = getUsername();
    listEl.innerHTML = "";
    emptyTip.classList.add("hidden");

    const res = await fetch(`/api/file/list?username=${encodeURIComponent(username)}`);
    const json = await res.json();
    if (json.code !== 200) {
      throw new Error(json.msg || "查询失败");
    }

    const files = json.data || [];
    if (files.length === 0) {
      emptyTip.classList.remove("hidden");
      return;
    }

    for (const item of files) {
      const row = document.createElement("div");
      row.className = "file-item";

      const meta = document.createElement("div");
      meta.className = "file-meta";
      meta.innerHTML = `
        <div class="file-name">${escapeHtml(item.file_name)}</div>
        <div class="file-detail">${formatSize(item.file_size)} · ${formatTime(item.create_time)}</div>
      `;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "download-btn";
      btn.textContent = "下载";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await downloadFile(item.file_url, item.file_name);
        } catch (err) {
          alert(err.message);
        } finally {
          btn.disabled = false;
        }
      });

      row.appendChild(meta);
      row.appendChild(btn);
      listEl.appendChild(row);
    }
  } catch (err) {
    listEl.innerHTML = "";
    emptyTip.textContent = err.message;
    emptyTip.classList.remove("hidden");
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function switchMode(mode) {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  document.getElementById("upload-panel").classList.toggle("hidden", mode !== "upload");
  document.getElementById("download-panel").classList.toggle("hidden", mode !== "download");
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});

document.getElementById("upload-btn").addEventListener("click", handleUpload);
document.getElementById("query-btn").addEventListener("click", handleQuery);

loadConfig().catch((err) => {
  setStatus(`初始化失败: ${err.message}`, "error");
});
