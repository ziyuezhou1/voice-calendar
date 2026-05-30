const NATIVE_LANGUAGE = "zh-CN";

export function hasNativeSpeechRecognition() {
  return Boolean(isNativeRuntime() && (getIntentSpeechPlugin() || getNativeSpeechPlugin()));
}

export async function startNativeSpeechRecognition({ onPartialResult, onStatus } = {}) {
  const servicePlugin = getNativeSpeechPlugin();
  const intentPlugin = getIntentSpeechPlugin();
  if (!servicePlugin && !intentPlugin) throw createSpeechError("native-unavailable", "当前运行环境没有 Android 原生语音识别插件。");

  if (servicePlugin) {
    const permission = await ensureNativeSpeechPermission(servicePlugin, onStatus);
    if (!isPermissionGranted(permission)) {
      throw createSpeechError("native-permission-denied", "请先允许 App 使用麦克风权限。");
    }
  }

  if (intentPlugin) {
    const result = await startIntentSpeechRecognition(intentPlugin, onStatus);
    if (result.text) return result;
  }

  if (!servicePlugin) throw createSpeechError("native-service-unavailable", "当前设备没有可用的系统语音识别服务。");

  const available = await servicePlugin.available?.();
  if (available && available.available === false) {
    throw createSpeechError("native-service-unavailable", "当前设备没有可用的系统语音识别服务。");
  }

  await servicePlugin.removeAllListeners?.();
  const listener = await servicePlugin.addListener?.("partialResults", (data) => {
    const text = normalizeMatches(data?.matches)[0] || "";
    if (text) onPartialResult?.(text);
  });

  try {
    onStatus?.("Android 原生语音识别已启动，请说出日程命令");
    const result = await servicePlugin.start({
      language: NATIVE_LANGUAGE,
      maxResults: 1,
      partialResults: true,
      popup: false,
      prompt: "请说出日程命令",
    });
    const text = normalizeMatches(result?.matches)[0] || "";
    return { text };
  } finally {
    await listener?.remove?.();
  }
}

export async function stopNativeSpeechRecognition() {
  const servicePlugin = getNativeSpeechPlugin();
  if (!servicePlugin?.stop) return;
  await servicePlugin.stop();
}

export function getSpeechAdapterErrorMessage(error) {
  const code = error?.code || error?.message || "unknown";
  const messages = {
    "native-unavailable": "当前不是 Android App 环境，可继续使用网页语音或文字命令。",
    "native-service-unavailable": "当前设备没有可用的系统语音识别服务，请安装或启用系统语音助手、Google App 或其他语音识别服务。",
    "native-permission-denied": "请先在系统设置中允许声历使用麦克风权限。",
    UNAVAILABLE: "当前设备没有可用的系统语音识别服务，请安装或启用系统语音助手、Google App 或其他语音识别服务。",
  };
  return messages[code] || `Android 原生语音识别失败：${code}`;
}

function getNativeSpeechPlugin() {
  const capacitor = window.Capacitor;
  if (!capacitor) return null;
  if (!capacitor.Plugins?.SpeechRecognition && typeof capacitor.registerPlugin === "function") {
    return capacitor.registerPlugin("SpeechRecognition");
  }
  return capacitor.Plugins?.SpeechRecognition || null;
}

function getIntentSpeechPlugin() {
  const capacitor = window.Capacitor;
  if (!capacitor) return null;
  if (!capacitor.Plugins?.IntentSpeech && typeof capacitor.registerPlugin === "function") {
    return capacitor.registerPlugin("IntentSpeech");
  }
  return capacitor.Plugins?.IntentSpeech || null;
}

async function startIntentSpeechRecognition(plugin, onStatus) {
  try {
    const available = await plugin.available?.();
    if (available && available.available === false) return { text: "" };

    onStatus?.("正在打开系统语音识别面板，请说出日程命令");
    const result = await plugin.start({
      language: NATIVE_LANGUAGE,
      maxResults: 1,
      prompt: "请说出日程命令",
    });
    const text = normalizeMatches(result?.matches)[0] || "";
    return { text };
  } catch (error) {
    if (error?.code === "intent-cancelled") return { text: "" };
    return { text: "" };
  }
}

function isNativeRuntime() {
  const capacitor = window.Capacitor;
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function") return capacitor.isNativePlatform();
  const platform = typeof capacitor.getPlatform === "function" ? capacitor.getPlatform() : "";
  return platform === "android" || platform === "ios";
}

async function ensureNativeSpeechPermission(plugin, onStatus) {
  const current = await plugin.checkPermissions?.();
  if (isPermissionGranted(current)) return current;
  onStatus?.("正在请求麦克风权限，请在系统弹窗中选择允许");
  return plugin.requestPermissions?.();
}

function isPermissionGranted(permission) {
  if (!permission) return false;
  return Object.values(permission).some((value) => value === "granted");
}

function normalizeMatches(matches) {
  return Array.isArray(matches) ? matches.map((match) => String(match).trim()).filter(Boolean) : [];
}

function createSpeechError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
