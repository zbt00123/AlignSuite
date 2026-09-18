/* ============================================================
   “对齐” Photoshop UXP 扩展
   index.js — v63
   ------------------------------------------------------------
   v63 改动（稳定性增强 + 多语言 tooltip 修复）：
     [1] applyLanguageToUI：用 setAttribute("title") 替代 el.title，
         并同步到 <img> 子元素，解决 UXP 中 tooltip 不刷新的问题。
     [2] initialize：applyLanguageToUI 之后 300ms 延迟重试一次，
         避开 UXP 首次渲染时机。
     [3] detectLinkPairs：利用链接传递性跳过已解析分量，
         复杂度从 O(n²) 降为 O(分量数 × n)。
     [4] fitSingleLayer：新增振荡检测（gap 未继续减小时停止迭代）。
     [5] isAdjustmentLayer：新增第 6 重检测
         （adjustmentData / adjustmentSettings）。
     [6] readLinkPairsViaDOM：失败过多时回退到探测法。
     [7] getLayerLinkedLayers：兼容 l.id 与 l._id。
     [8] getSpacing：空值保护。
   v62 改动（保留，多语言支持）：I18N 表 + t/tf/applyLanguageToUI/
     localizeLabels/getLocalizedErrorMessage。
   ============================================================ */

const { app, core, action, imaging, constants } = require("photoshop");
const { batchPlay } = action;


/* ============================================================
   多语言（i18n）—— v62 起
   ============================================================ */

const I18N = {
    /* ---------- 中文（逐字对照 v61，不得修改） ---------- */
    zh: {
        labelAlignTo: "对齐到：",
        labelAlign: "对齐：",
        labelDistribute: "分布：",
        labelSpacing: "间距：",
        unitPx: "px",

        chkPrecise: "精确排列",
        chkIgnoreLink: "忽略链接",
        chkIgnoreAdjustment: "忽略调整层",
        chkAlignByGroup: "按组对齐",

        tipFitCanvas: "撑满画布",
        tipAutoAlign: "自动对齐图层",
        tipFitHeight: "基于高度对齐",
        tipFitWidth: "基于宽度对齐",

        tipRefCanvas: "对齐到画布",
        tipRefSelection: "对齐到所选",
        tipRefKeyObject: "对齐到关键对象",

        alignLeft: "左对齐",
        alignHCenter: "水平居中",
        alignRight: "右对齐",
        alignTop: "顶对齐",
        alignVCenter: "垂直居中",
        alignBottom: "底对齐",

        distLeft: "按左分布",
        distHCenter: "水平分布",
        distRight: "按右分布",
        distTop: "按顶分布",
        distVCenter: "垂直分布",
        distBottom: "按底分布",

        arrangeH: "水平排列",
        arrangeV: "垂直排列",

        fitCanvas: "撑满画布",
        fitHeight: "基于高度对齐",
        fitWidth: "基于宽度对齐",
        autoAlignLayers: "自动对齐图层",

        histPrefixAlign: "对齐 -",
        histPrefixDist: "分布 -",
        histPrefixArrange: "排列 -",

        userCancelled: "用户已取消",
        operationFailed: "操作失败",
        noOpenDocument: "没有打开的文档",
        invalidTranslation: "无法计算移动距离",
        invalidAlignment: "无法计算对齐位置",
        invalidDistribution: "无法计算分布位置",
        invalidArrange: "无法计算排列位置",
        invalidSpacing: "间距参数无效",
        invalidLayerId: "图层标识无效",
        unknownAlignMode: "未知的对齐模式",
        unknownDistMode: "未知的分布模式",
        unknownArrangeMode: "未知的排列模式",
        unknownFitMode: "未知的缩放模式",
        invalidLayerSize: "无效的图层尺寸",
        cannotComputeBounds: "当前对象无法计算有效边界",
        cannotComputeBoundsShort: "无法计算有效边界",
        noSelectedLayers: "没有选中图层",
        cannotDetermineTarget: "无法确定对齐目标",
        onlyAdjustmentAlign: "当前仅选中调整层，无可对齐对象",
        onlyAdjustmentDist: "当前仅选中调整层，无可分布对象",
        onlyAdjustmentArrange: "当前仅选中调整层，无可排列对象",
        onlyAdjustmentProcess: "当前仅选中调整层，无可处理对象",
        noValidAlignObjects: "没有可对齐的有效对象",
        cannotGetCanvasSize: "无法获取画布尺寸",
        cannotReadLayerPos: "无法读取选中图层的位置信息",
        autoAlignNoMove: "自动对齐未产生位移，图层内容差异过大",
        enablePreciseArrangeFirst: "请先勾选精确排列",
        cannotDetermineKeyObject: "无法可靠确定关键对象",
        notImplementedAlign: "对齐：{0} 待实现",
        notImplementedDist: "分布：{0} 待实现",
        autoAlignDone: "自动对齐完成",
        opCompleted: "{0}完成",

        needLayers: "当前操作至少需要 {0} 个图层",
        needObjects: "当前操作至少需要 {0} 个对象",
        needArrangeObjects: "当前操作至少需要 {0} 个可排列对象",
        autoAlignNeedLayers: "自动对齐图层至少需要 {0} 个图层"
    },

    /* ---------- 英语 ---------- */
    en: {
        labelAlignTo: "Align to:",
        labelAlign: "Align:",
        labelDistribute: "Distribute:",
        labelSpacing: "Spacing:",
        unitPx: "px",

        chkPrecise: "Precise Arrange",
        chkIgnoreLink: "Ignore Links",
        chkIgnoreAdjustment: "Ignore Adjustments",
        chkAlignByGroup: "Align by Group",

        tipFitCanvas: "Fit to Canvas",
        tipAutoAlign: "Auto-Align Layers",
        tipFitHeight: "Fit to Height",
        tipFitWidth: "Fit to Width",

        tipRefCanvas: "Align to Canvas",
        tipRefSelection: "Align to Selection",
        tipRefKeyObject: "Align to Key Object",

        alignLeft: "Align Left",
        alignHCenter: "Align Horizontal Centers",
        alignRight: "Align Right",
        alignTop: "Align Top",
        alignVCenter: "Align Vertical Centers",
        alignBottom: "Align Bottom",

        distLeft: "Distribute Left Edges",
        distHCenter: "Distribute Horizontal Centers",
        distRight: "Distribute Right Edges",
        distTop: "Distribute Top Edges",
        distVCenter: "Distribute Vertical Centers",
        distBottom: "Distribute Bottom Edges",

        arrangeH: "Arrange Horizontally",
        arrangeV: "Arrange Vertically",

        fitCanvas: "Fit to Canvas",
        fitHeight: "Fit to Height",
        fitWidth: "Fit to Width",
        autoAlignLayers: "Auto-Align Layers",

        histPrefixAlign: "Align -",
        histPrefixDist: "Distribute -",
        histPrefixArrange: "Arrange -",

        userCancelled: "User cancelled",
        operationFailed: "Operation failed",
        noOpenDocument: "No open document",
        invalidTranslation: "Cannot compute translation",
        invalidAlignment: "Cannot compute alignment position",
        invalidDistribution: "Cannot compute distribution position",
        invalidArrange: "Cannot compute arrangement position",
        invalidSpacing: "Invalid spacing",
        invalidLayerId: "Invalid layer id",
        unknownAlignMode: "Unknown alignment mode",
        unknownDistMode: "Unknown distribution mode",
        unknownArrangeMode: "Unknown arrangement mode",
        unknownFitMode: "Unknown fit mode",
        invalidLayerSize: "Invalid layer size",
        cannotComputeBounds: "Cannot compute valid bounds for current object",
        cannotComputeBoundsShort: "Cannot compute valid bounds",
        noSelectedLayers: "No layers selected",
        cannotDetermineTarget: "Cannot determine alignment target",
        onlyAdjustmentAlign: "Only adjustment layers selected; nothing to align",
        onlyAdjustmentDist: "Only adjustment layers selected; nothing to distribute",
        onlyAdjustmentArrange: "Only adjustment layers selected; nothing to arrange",
        onlyAdjustmentProcess: "Only adjustment layers selected; nothing to process",
        noValidAlignObjects: "No valid objects to align",
        cannotGetCanvasSize: "Cannot obtain canvas size",
        cannotReadLayerPos: "Cannot read positions of selected layers",
        autoAlignNoMove: "Auto-align produced no movement; layer contents differ too much",
        enablePreciseArrangeFirst: "Please enable \"Precise Arrange\" first",
        cannotDetermineKeyObject: "Cannot reliably determine key object",
        notImplementedAlign: "Align: {0} not implemented",
        notImplementedDist: "Distribute: {0} not implemented",
        autoAlignDone: "Auto-align complete",
        opCompleted: "{0} complete",

        needLayers: "This operation requires at least {0} layers",
        needObjects: "This operation requires at least {0} objects",
        needArrangeObjects: "This operation requires at least {0} objects to arrange",
        autoAlignNeedLayers: "Auto-align requires at least {0} layers"
    },

    /* ---------- 日语 ---------- */
    ja: {
        labelAlignTo: "整列先：",
        labelAlign: "整列：",
        labelDistribute: "分布：",
        labelSpacing: "間隔：",
        unitPx: "px",

        chkPrecise: "正確に整列",
        chkIgnoreLink: "リンクを無視",
        chkIgnoreAdjustment: "調整レイヤーを無視",
        chkAlignByGroup: "グループ単位で整列",

        tipFitCanvas: "カンバスに合わせる",
        tipAutoAlign: "レイヤーを自動整列",
        tipFitHeight: "高さに合わせる",
        tipFitWidth: "幅に合わせる",

        tipRefCanvas: "カンバスに整列",
        tipRefSelection: "選択範囲に整列",
        tipRefKeyObject: "キーオブジェクトに整列",

        alignLeft: "左揃え",
        alignHCenter: "水平方向中央揃え",
        alignRight: "右揃え",
        alignTop: "上揃え",
        alignVCenter: "垂直方向中央揃え",
        alignBottom: "下揃え",

        distLeft: "左端を分布",
        distHCenter: "水平方向に分布",
        distRight: "右端を分布",
        distTop: "上端を分布",
        distVCenter: "垂直方向に分布",
        distBottom: "下端を分布",

        arrangeH: "水平に配置",
        arrangeV: "垂直に配置",

        fitCanvas: "カンバスに合わせる",
        fitHeight: "高さに合わせる",
        fitWidth: "幅に合わせる",
        autoAlignLayers: "レイヤーを自動整列",

        histPrefixAlign: "整列 -",
        histPrefixDist: "分布 -",
        histPrefixArrange: "配置 -",

        userCancelled: "ユーザーがキャンセルしました",
        operationFailed: "操作に失敗しました",
        noOpenDocument: "ドキュメントが開かれていません",
        invalidTranslation: "移動距離を計算できません",
        invalidAlignment: "整列位置を計算できません",
        invalidDistribution: "分布位置を計算できません",
        invalidArrange: "配置位置を計算できません",
        invalidSpacing: "間隔パラメータが無効です",
        invalidLayerId: "レイヤー ID が無効です",
        unknownAlignMode: "不明な整列モード",
        unknownDistMode: "不明な分布モード",
        unknownArrangeMode: "不明な配置モード",
        unknownFitMode: "不明なスケールモード",
        invalidLayerSize: "レイヤーサイズが無効です",
        cannotComputeBounds: "現在のオブジェクトの有効な境界を計算できません",
        cannotComputeBoundsShort: "有効な境界を計算できません",
        noSelectedLayers: "レイヤーが選択されていません",
        cannotDetermineTarget: "整列の基準を特定できません",
        onlyAdjustmentAlign: "調整レイヤーのみ選択されており、整列対象がありません",
        onlyAdjustmentDist: "調整レイヤーのみ選択されており、分布対象がありません",
        onlyAdjustmentArrange: "調整レイヤーのみ選択されており、配置対象がありません",
        onlyAdjustmentProcess: "調整レイヤーのみ選択されており、処理対象がありません",
        noValidAlignObjects: "整列できる有効なオブジェクトがありません",
        cannotGetCanvasSize: "カンバスサイズを取得できません",
        cannotReadLayerPos: "選択レイヤーの位置情報を取得できません",
        autoAlignNoMove: "自動整列で移動が発生しませんでした。レイヤー内容の差異が大きすぎます",
        enablePreciseArrangeFirst: "先に「正確に整列」を有効にしてください",
        cannotDetermineKeyObject: "キーオブジェクトを確実に特定できません",
        notImplementedAlign: "整列：{0} 未実装",
        notImplementedDist: "分布：{0} 未実装",
        autoAlignDone: "自動整列が完了しました",
        opCompleted: "{0}が完了しました",

        needLayers: "この操作には最低 {0} 個のレイヤーが必要です",
        needObjects: "この操作には最低 {0} 個のオブジェクトが必要です",
        needArrangeObjects: "この操作には最低 {0} 個の配置可能なオブジェクトが必要です",
        autoAlignNeedLayers: "自動整列には最低 {0} 個のレイヤーが必要です"
    },

    /* ---------- 韩语 ---------- */
    ko: {
        labelAlignTo: "정렬 기준：",
        labelAlign: "정렬：",
        labelDistribute: "분포：",
        labelSpacing: "간격：",
        unitPx: "px",

        chkPrecise: "정확히 정렬",
        chkIgnoreLink: "링크 무시",
        chkIgnoreAdjustment: "조정 레이어 무시",
        chkAlignByGroup: "그룹 단위로 정렬",

        tipFitCanvas: "캔버스에 맞춤",
        tipAutoAlign: "레이어 자동 정렬",
        tipFitHeight: "높이에 맞춤",
        tipFitWidth: "너비에 맞춤",

        tipRefCanvas: "캔버스에 정렬",
        tipRefSelection: "선택 영역에 정렬",
        tipRefKeyObject: "키 오브젝트에 정렬",

        alignLeft: "왼쪽 정렬",
        alignHCenter: "가로 가운데 정렬",
        alignRight: "오른쪽 정렬",
        alignTop: "위쪽 정렬",
        alignVCenter: "세로 가운데 정렬",
        alignBottom: "아래쪽 정렬",

        distLeft: "왼쪽 가장자리 기준 분포",
        distHCenter: "가로 방향 분포",
        distRight: "오른쪽 가장자리 기준 분포",
        distTop: "위쪽 가장자리 기준 분포",
        distVCenter: "세로 방향 분포",
        distBottom: "아래쪽 가장자리 기준 분포",

        arrangeH: "가로로 배열",
        arrangeV: "세로로 배열",

        fitCanvas: "캔버스에 맞춤",
        fitHeight: "높이에 맞춤",
        fitWidth: "너비에 맞춤",
        autoAlignLayers: "레이어 자동 정렬",

        histPrefixAlign: "정렬 -",
        histPrefixDist: "분포 -",
        histPrefixArrange: "배열 -",

        userCancelled: "사용자 취소됨",
        operationFailed: "작업 실패",
        noOpenDocument: "열린 문서가 없습니다",
        invalidTranslation: "이동 거리를 계산할 수 없습니다",
        invalidAlignment: "정렬 위치를 계산할 수 없습니다",
        invalidDistribution: "분포 위치를 계산할 수 없습니다",
        invalidArrange: "배열 위치를 계산할 수 없습니다",
        invalidSpacing: "간격 값이 잘못되었습니다",
        invalidLayerId: "잘못된 레이어 ID",
        unknownAlignMode: "알 수 없는 정렬 모드",
        unknownDistMode: "알 수 없는 분포 모드",
        unknownArrangeMode: "알 수 없는 배열 모드",
        unknownFitMode: "알 수 없는 크기 조정 모드",
        invalidLayerSize: "레이어 크기가 잘못되었습니다",
        cannotComputeBounds: "현재 객체의 유효 경계를 계산할 수 없습니다",
        cannotComputeBoundsShort: "유효 경계를 계산할 수 없습니다",
        noSelectedLayers: "레이어가 선택되지 않았습니다",
        cannotDetermineTarget: "정렬 대상을 결정할 수 없습니다",
        onlyAdjustmentAlign: "조정 레이어만 선택되어 정렬할 대상이 없습니다",
        onlyAdjustmentDist: "조정 레이어만 선택되어 분포할 대상이 없습니다",
        onlyAdjustmentArrange: "조정 레이어만 선택되어 배열할 대상이 없습니다",
        onlyAdjustmentProcess: "조정 레이어만 선택되어 처리할 대상이 없습니다",
        noValidAlignObjects: "정렬할 수 있는 유효한 객체가 없습니다",
        cannotGetCanvasSize: "캔버스 크기를 가져올 수 없습니다",
        cannotReadLayerPos: "선택한 레이어의 위치 정보를 읽을 수 없습니다",
        autoAlignNoMove: "자동 정렬로 위치가 변경되지 않았습니다. 레이어 내용 차이가 너무 큽니다",
        enablePreciseArrangeFirst: "먼저 \"정확히 정렬\"을 활성화하세요",
        cannotDetermineKeyObject: "키 오브젝트를 안정적으로 결정할 수 없습니다",
        notImplementedAlign: "정렬: {0} 미구현",
        notImplementedDist: "분포: {0} 미구현",
        autoAlignDone: "자동 정렬 완료",
        opCompleted: "{0} 완료",

        needLayers: "이 작업에는 최소 {0}개의 레이어가 필요합니다",
        needObjects: "이 작업에는 최소 {0}개의 객체가 필요합니다",
        needArrangeObjects: "이 작업에는 최소 {0}개의 배열 가능한 객체가 필요합니다",
        autoAlignNeedLayers: "자동 정렬에는 최소 {0}개의 레이어가 필요합니다"
    }
};

let currentLang = "en";

function detectLanguage() {
    let locale = "";
    try { locale = String(app.locale || "").toLowerCase(); } catch (e) {}
    if (!locale) {
        try { locale = String(navigator.language || "").toLowerCase(); } catch (e) {}
    }
    if (locale.indexOf("zh") === 0) return "zh";
    if (locale.indexOf("ja") === 0) return "ja";
    if (locale.indexOf("ko") === 0) return "ko";
    if (locale.indexOf("en") === 0) return "en";
    return "en";
}

function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key])
        || I18N.en[key]
        || key;
}

function tf(key, ...args) {
    let s = t(key);
    for (let i = 0; i < args.length; i++) {
        s = s.split("{" + i + "}").join(String(args[i]));
    }
    return s;
}


/* ---------- DOM 缓存 ---------- */

const dom = {
    body: document.body,
    panel: document.getElementById("panel"),
    btnFitCanvas: document.getElementById("btnFitCanvas"),
    btnAutoAlign: document.getElementById("btnAutoAlign") || document.getElementById("btnPixelAlign"),
    btnFitHeight: document.getElementById("btnFitHeight"),
    btnFitWidth: document.getElementById("btnFitWidth"),
    refButtons: Array.from(document.querySelectorAll(".ref-button")),
    alignButtons: Array.from(document.querySelectorAll(".op-button[data-align]")),
    distButtons: Array.from(document.querySelectorAll(".op-button[data-dist]")),
    btnArrangeH: document.getElementById("btnArrangeH"),
    btnArrangeV: document.getElementById("btnArrangeV"),
    imgArrangeH: document.getElementById("imgArrangeH"),
    imgArrangeV: document.getElementById("imgArrangeV"),
    spacingInput: document.getElementById("spacingInput"),
    checkboxRow: document.getElementById("checkboxRow"),
    chkPrecise: document.getElementById("chkPrecise"),
    chkIgnoreLink: document.getElementById("chkIgnoreLink"),
    chkIgnoreAdjustment: document.getElementById("chkIgnoreAdjustment"),
    chkAlignByGroup: document.getElementById("chkAlignByGroup"),
    toast: document.getElementById("toast")
};


/* ---------- 状态与常量 ---------- */

let alignReference = "canvas";
let isBusy = false;
let initialized = false;
let lastKeyObjectId = null;
let lastSelectedIds = new Set();
let toastTimer = null;
let toastAnimTimer = null;
let busyReleaseTimer = null;
let abortRequested = false;
let lastOperationAborted = false;
let lastAbortReason = "";
let layerNameCache = new Map();
let activeLinkPairs = [];

const BUSY_RELEASE_DELAY = 500;
const MIN_MOVE_EPSILON = 1e-6;
const TOAST_ANIM_DURATION = 200;
const TOAST_HOLD_DURATION = 3000;
const TOAST_FRAME_MS = 16;
const TOAST_TRAVEL_Y = 20;
const TOAST_BG_MAX_ALPHA = 1.0;
const TOAST_COLORS = {
    success: { bg: [243,255,229], fg: [26,121,0] },
    info:    { bg: [229,246,255], fg: [16,82,164] },
    warning: { bg: [255,242,229], fg: [228,91,0] },
    error:   { bg: [255,229,229], fg: [177,10,16] }
};
const MIN_DIST_LAYERS = 3;
const MIN_ARRANGE_LAYERS = 2;
const MAX_PIXEL_SCAN_AREA = 5000000;
const AUTO_ALIGN_MIN_LAYERS = 2;
const AUTO_ALIGN_MOVE_THRESHOLD = 0.5;
const LINK_DEBUG = true;
const LINK_DETECT_DELTA = 3;
const LINK_DETECT_TOLERANCE = 0.5;
const SELECT_STEP_DELAY = 15;

/* v61：迭代缩放的最多次数和像素容差 */
const FIT_MAX_ITERATIONS = 3;
const FIT_PIXEL_TOLERANCE = 0.5;
/* v63：振荡检测容差（像素）——若一次迭代的 gap 未减少至少此值，停止迭代 */
const FIT_OSCILLATION_TOLERANCE = 0.01;

const ARRANGE_ICON_ON = { h: "icons/arrange-h-on.png", v: "icons/arrange-v-on.png" };
const ARRANGE_ICON_OFF = { h: "icons/arrange-h-off.png", v: "icons/arrange-v-off.png" };

/* v62：标签对象由 localizeLabels() 填充 */
let ALIGN_MODE_LABELS = {};
let ALIGN_MODE_HISTORY_NAMES = {};
let DIST_MODE_LABELS = {};
let DIST_MODE_HISTORY_NAMES = {};
let ARRANGE_MODE_LABELS = {};
let ARRANGE_MODE_HISTORY_NAMES = {};
let FIT_MODE_LABELS = {};
let FIT_MODE_HISTORY_NAMES = {};

const DIST_MODE_CONFIG = {
    left:{sortKey:"left",axis:"x"}, hcenter:{sortKey:"centerX",axis:"x"}, right:{sortKey:"right",axis:"x"},
    top:{sortKey:"top",axis:"y"}, vcenter:{sortKey:"centerY",axis:"y"}, bottom:{sortKey:"bottom",axis:"y"}
};
const PRECISE_DIST_CONFIG = DIST_MODE_CONFIG;

const ADJUSTMENT_KIND_NUMBERS = new Set([22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37]);
const ADJUSTMENT_KIND_STRINGS = new Set([
    "blackandwhite","brightness","brightnesscontrast","channelmixer","colorbalance","colorlookup",
    "curves","exposure","gradientmap","huesaturation","inversion","levels",
    "photofilter","posterize","selectivecolor","threshold","vibrance"
]);


/* ---------- i18n UI 应用（v63：加强 tooltip 更新） ---------- */

function applyLanguageToUI() {
    try {
        /* 1) 可见文本 */
        const textEls = document.querySelectorAll("[data-i18n]");
        for (const el of textEls) {
            const key = el.getAttribute("data-i18n");
            if (!key) continue;
            el.textContent = t(key);
        }

        /* 2) tooltip / aria-label —— v63 加强版 */
        const tipEls = document.querySelectorAll("[data-i18n-tip]");
        for (const el of tipEls) {
            const key = el.getAttribute("data-i18n-tip");
            if (!key) continue;
            const s = t(key);

            /* 用 setAttribute 替代 el.title = s（更可靠） */
            el.setAttribute("title", s);
            el.setAttribute("aria-label", s);
            /* 后备：data-tooltip（若 UXP 未来支持） */
            el.setAttribute("data-tooltip", s);

            /* 同步到内部的 img 子元素（防止鼠标落在图片上） */
            const imgs = el.querySelectorAll("img");
            for (const img of imgs) {
                img.setAttribute("title", s);
                img.setAttribute("aria-label", s);
                /* alt 保持空字符串，避免破坏无障碍语义 */
            }
        }

        console.log("[i18n][apply] data-i18n 应用完成");
    } catch (e) {
        console.error("[i18n][apply] 失败:", e);
    }
}

function localizeLabels() {
    ALIGN_MODE_LABELS = {
        left: t("alignLeft"),
        hcenter: t("alignHCenter"),
        right: t("alignRight"),
        top: t("alignTop"),
        vcenter: t("alignVCenter"),
        bottom: t("alignBottom")
    };
    ALIGN_MODE_HISTORY_NAMES = {
        left:    t("histPrefixAlign") + " " + t("alignLeft"),
        hcenter: t("histPrefixAlign") + " " + t("alignHCenter"),
        right:   t("histPrefixAlign") + " " + t("alignRight"),
        top:     t("histPrefixAlign") + " " + t("alignTop"),
        vcenter: t("histPrefixAlign") + " " + t("alignVCenter"),
        bottom:  t("histPrefixAlign") + " " + t("alignBottom")
    };
    DIST_MODE_LABELS = {
        left: t("distLeft"),
        hcenter: t("distHCenter"),
        right: t("distRight"),
        top: t("distTop"),
        vcenter: t("distVCenter"),
        bottom: t("distBottom")
    };
    DIST_MODE_HISTORY_NAMES = {
        left:    t("histPrefixDist") + " " + t("distLeft"),
        hcenter: t("histPrefixDist") + " " + t("distHCenter"),
        right:   t("histPrefixDist") + " " + t("distRight"),
        top:     t("histPrefixDist") + " " + t("distTop"),
        vcenter: t("histPrefixDist") + " " + t("distVCenter"),
        bottom:  t("histPrefixDist") + " " + t("distBottom")
    };
    ARRANGE_MODE_LABELS = {
        h: t("arrangeH"),
        v: t("arrangeV")
    };
    ARRANGE_MODE_HISTORY_NAMES = {
        h: t("histPrefixArrange") + " " + t("arrangeH"),
        v: t("histPrefixArrange") + " " + t("arrangeV")
    };
    FIT_MODE_LABELS = {
        fitCanvas: t("fitCanvas"),
        fitHeight: t("fitHeight"),
        fitWidth:  t("fitWidth")
    };
    FIT_MODE_HISTORY_NAMES = {
        fitCanvas: t("histPrefixAlign") + " " + t("fitCanvas"),
        fitHeight: t("histPrefixAlign") + " " + t("fitHeight"),
        fitWidth:  t("histPrefixAlign") + " " + t("fitWidth")
    };
}


/* ---------- Theme ---------- */

function updateTheme(themeValue) {
    const theme = String(themeValue || "").toLowerCase();
    document.body.classList.remove("theme-lightest","theme-light","theme-medium","theme-dark","theme-darkest");
    if (theme === "lightest") document.body.classList.add("theme-lightest");
    else if (theme === "light") document.body.classList.add("theme-light");
    else if (theme === "medium") document.body.classList.add("theme-medium");
    else if (theme === "dark") document.body.classList.add("theme-dark");
    else if (theme === "darkest") document.body.classList.add("theme-darkest");
    else document.body.classList.add("theme-dark");
}
function initTheme() {
    if (document.theme) {
        updateTheme(document.theme.getCurrent());
        if (document.theme.onUpdated) document.theme.onUpdated.addListener(updateTheme);
    } else updateTheme("dark");
}


/* ---------- UI 状态 ---------- */

function setCheckboxDisabled(cb, d) {
    if (!cb) return;
    cb.disabled = !!d;
    const l = cb.closest(".checkbox-label");
    if (l) l.classList.toggle("is-disabled", !!d);
}
function updateAlignByGroupCheckbox() { if (dom.chkAlignByGroup) setCheckboxDisabled(dom.chkAlignByGroup, false); }
function updateIgnoreLinkCheckbox() { if (dom.chkIgnoreLink) setCheckboxDisabled(dom.chkIgnoreLink, false); }
function updateIgnoreAdjustmentCheckbox() { if (dom.chkIgnoreAdjustment) setCheckboxDisabled(dom.chkIgnoreAdjustment, false); }
function updateSpacingInputState() { if (dom.spacingInput) dom.spacingInput.disabled = false; }
function updateArrangeButtonsUI() {
    const precise = !!(dom.chkPrecise && dom.chkPrecise.checked);
    if (dom.imgArrangeH) dom.imgArrangeH.src = precise ? ARRANGE_ICON_ON.h : ARRANGE_ICON_OFF.h;
    if (dom.imgArrangeV) dom.imgArrangeV.src = precise ? ARRANGE_ICON_ON.v : ARRANGE_ICON_OFF.v;
}
function updateUIState() {
    updateAlignByGroupCheckbox();
    updateIgnoreLinkCheckbox();
    updateIgnoreAdjustmentCheckbox();
    updateSpacingInputState();
    updateArrangeButtonsUI();
}
function updateRefButtonsUI() {
    dom.refButtons.forEach(btn => {
        if (btn.dataset.ref === alignReference) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}
function setBusy(v) {
    if (busyReleaseTimer) { clearTimeout(busyReleaseTimer); busyReleaseTimer = null; }
    isBusy = !!v;
    if (isBusy) document.body.classList.add("is-busy");
    else document.body.classList.remove("is-busy");
}
function scheduleBusyRelease(delay) {
    if (busyReleaseTimer) clearTimeout(busyReleaseTimer);
    busyReleaseTimer = setTimeout(() => {
        busyReleaseTimer = null;
        isBusy = false;
        document.body.classList.remove("is-busy");
    }, delay);
}


/* ---------- 输入验证 ---------- */

function parseSpacing(v) {
    const n = Number(String(v).trim());
    if (!Number.isFinite(n)) return 0;
    return Math.max(-9999, Math.min(9999, n));
}
function clampSpacingToInt(v) {
    let n = Number(v);
    if (!Number.isFinite(n)) n = 0;
    n = Math.round(n);
    return Math.max(-9999, Math.min(9999, n));
}
/* v63：空值保护 */
function getSpacing() {
    if (!dom.spacingInput) return 0;
    return parseSpacing(dom.spacingInput.value);
}
function isPreciseMode() { return !!(dom.chkPrecise && dom.chkPrecise.checked); }
function isAlignByGroup() { return !!(dom.chkAlignByGroup && dom.chkAlignByGroup.checked); }
function isIgnoreLink() { return !!(dom.chkIgnoreLink && dom.chkIgnoreLink.checked); }
function isIgnoreAdjustment() { return !!(dom.chkIgnoreAdjustment && dom.chkIgnoreAdjustment.checked); }


/* ---------- ESC ---------- */

function setupEscListener() {
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" || event.keyCode === 27) {
            if (isBusy) {
                abortRequested = true;
                console.log("[ESC] 用户请求中止");
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }, true);
}


/* ---------- 提示本地化（v62） ---------- */

function isUserCancelError(error) {
    if (!error) return false;
    const msg = String((error && error.message) || error || "");
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.indexOf("user cancelled") !== -1 || lower.indexOf("user canceled") !== -1
        || lower.indexOf("cancelled by user") !== -1 || lower.indexOf("canceled by user") !== -1
        || lower.indexOf("operation cancelled") !== -1 || lower.indexOf("operation canceled") !== -1
        || (lower.indexOf("cancelled") !== -1 && lower.indexOf("user") !== -1)
        || (lower.indexOf("canceled") !== -1 && lower.indexOf("user") !== -1)
        || msg.indexOf("用户已取消") !== -1 || msg.indexOf("用户取消") !== -1
        || msg.indexOf("ユーザーがキャンセル") !== -1
        || msg.indexOf("사용자 취소") !== -1;
}

function getLocalizedErrorMessage(error) {
    if (!error) return t("operationFailed");
    const msg = String((error && error.message) || error || "");
    const lower = msg.toLowerCase();

    if (isUserCancelError(error)) return t("userCancelled");
    if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(msg)) return msg;

    if (lower.indexOf("no active document") !== -1) return t("noOpenDocument");
    if (lower.indexOf("no open document") !== -1) return t("noOpenDocument");
    if (lower.indexOf("invalid translation") !== -1) return t("invalidTranslation");
    if (lower.indexOf("invalid alignment") !== -1) return t("invalidAlignment");
    if (lower.indexOf("invalid distribution") !== -1) return t("invalidDistribution");
    if (lower.indexOf("invalid arrange") !== -1) return t("invalidArrange");
    if (lower.indexOf("invalid precise") !== -1) return t("invalidArrange");
    if (lower.indexOf("invalid spacing") !== -1) return t("invalidSpacing");
    if (lower.indexOf("invalid layer id") !== -1) return t("invalidLayerId");
    if (lower.indexOf("unknown alignment mode") !== -1) return t("unknownAlignMode");
    if (lower.indexOf("unknown distribution mode") !== -1) return t("unknownDistMode");
    if (lower.indexOf("unknown arrange mode") !== -1) return t("unknownArrangeMode");
    if (lower.indexOf("unknown fit mode") !== -1) return t("unknownFitMode");
    if (lower.indexOf("invalid layer size") !== -1) return t("invalidLayerSize");
    if (lower.indexOf("cannot compute valid bounds for current object") !== -1) return t("cannotComputeBounds");
    if (lower.indexOf("cannot compute valid bounds after scaling") !== -1) return t("cannotComputeBoundsShort");
    if (lower.indexOf("cannot compute valid bounds") !== -1) return t("cannotComputeBoundsShort");
    if (lower.indexOf("invalid bounds") !== -1) return t("cannotComputeBounds");
    if (lower.indexOf("can not calculate") !== -1) return t("cannotComputeBoundsShort");
    if (lower.indexOf("cannot calculate") !== -1) return t("cannotComputeBoundsShort");

    return t("operationFailed");
}


/* ---------- Toast ---------- */

function stopToastAnimation() {
    if (toastAnimTimer) { clearInterval(toastAnimTimer); toastAnimTimer = null; }
}
function toastEaseInOutQuad(t) {
    if (t < 0.5) return 2 * t * t;
    return 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function applyToastVisual(level, easedAlpha) {
    const c = TOAST_COLORS[level] || TOAST_COLORS.info;
    const bgAlpha = TOAST_BG_MAX_ALPHA * easedAlpha;
    dom.toast.style.background = "rgba(" + c.bg[0] + "," + c.bg[1] + "," + c.bg[2] + "," + bgAlpha + ")";
    dom.toast.style.color = "rgba(" + c.fg[0] + "," + c.fg[1] + "," + c.fg[2] + "," + easedAlpha + ")";
}
function runToastAnimation(aFrom, aTo, yFrom, yTo, dur, level, onDone) {
    stopToastAnimation();
    const startTime = Date.now();
    dom.toast.style.display = "block";
    applyToastVisual(level, aFrom);
    dom.toast.style.transform = "translateY(" + yFrom + "px)";
    toastAnimTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        let t = elapsed / dur;
        if (t > 1) t = 1;
        const eased = toastEaseInOutQuad(t);
        applyToastVisual(level, aFrom + (aTo - aFrom) * eased);
        dom.toast.style.transform = "translateY(" + (yFrom + (yTo - yFrom) * eased) + "px)";
        if (t >= 1) {
            clearInterval(toastAnimTimer); toastAnimTimer = null;
            if (typeof onDone === "function") onDone();
        }
    }, TOAST_FRAME_MS);
}
function showToast(message, type) {
    if (!dom.toast) return;
    const text = String(message || "");
    const allowed = ["success","info","warning","error"];
    const safeType = allowed.indexOf(type) !== -1 ? type : "info";
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    stopToastAnimation();
    dom.toast.textContent = text;
    dom.toast.style.display = "block";
    applyToastVisual(safeType, 0);
    dom.toast.style.transform = "translateY(" + TOAST_TRAVEL_Y + "px)";
    runToastAnimation(0, 1, TOAST_TRAVEL_Y, 0, TOAST_ANIM_DURATION, safeType, () => {
        toastTimer = setTimeout(() => {
            toastTimer = null;
            runToastAnimation(1, 0, 0, TOAST_TRAVEL_Y, TOAST_ANIM_DURATION, safeType, () => {
                dom.toast.style.display = "none";
                dom.toast.style.background = "rgba(229,246,255,0)";
                dom.toast.style.color = "rgba(16,82,164,0)";
            });
        }, TOAST_HOLD_DURATION);
    });
}


/* ---------- 按钮绑定 ---------- */

function bindButton(button, handler) {
    if (!button) return;
    button.addEventListener("click", event => {
        event.preventDefault();
        button.blur();
        handler(event);
    });
    button.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            button.blur();
            handler(event);
        }
    });
}


/* ---------- batchPlay ---------- */

async function runBatchPlay(descriptors, options = {}) {
    if (!Array.isArray(descriptors)) throw new Error("batchPlay descriptors must be an array");
    return await batchPlay(descriptors, {
        synchronousExecution: true,
        continueOnError: false,
        immediateRedraw: false,
        ...options
    });
}
function delayMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }


/* ---------- 关键对象监听 ---------- */

function setupKeyObjectListener() {
    if (!action || typeof action.addNotificationListener !== "function") return;
    try {
        action.addNotificationListener(["select"], onSelectNotification);
        console.log("[keyObject] select 通知监听器已注册");
    } catch (e) {
        console.error("[keyObject] 注册通知监听器失败:", e);
    }
}
function parseLayerIdField(raw) {
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) return raw.map(n => Number(n)).filter(n => Number.isFinite(n));
    const n = Number(raw);
    return Number.isFinite(n) ? [n] : [];
}
function parseSelectionModifier(desc) {
    const m = desc && desc.selectionModifier;
    if (!m) return "";
    if (typeof m === "string") return m;
    if (m._value) return String(m._value);
    return "";
}
function findLayerByIdInDoc(doc, targetId) {
    if (!doc) return null;
    const id = Number(targetId);
    if (!Number.isFinite(id)) return null;
    function walk(layers) {
        if (!layers || !layers.length) return null;
        for (const layer of layers) {
            if (Number(layer.id) === id) return layer;
            try {
                const children = layer.layers;
                if (children && typeof children.length === "number") {
                    const f = walk(children);
                    if (f) return f;
                }
            } catch (e) {}
        }
        return null;
    }
    try { return walk(doc.layers); } catch (e) { return null; }
}
function refreshLayerNameCache(doc) {
    layerNameCache = new Map();
    if (!doc) return;
    function walk(layers) {
        if (!layers || !layers.length) return;
        for (const layer of layers) {
            const id = Number(layer.id);
            if (Number.isFinite(id)) {
                try { if (layer.name != null) layerNameCache.set(id, String(layer.name)); } catch (e) {}
            }
            try {
                const children = layer.layers;
                if (children && typeof children.length === "number" && children.length) walk(children);
            } catch (e) {}
        }
    }
    try { walk(doc.layers); } catch (e) {}
}
function makeSelectTarget(layerId) { return { _ref: "layer", _id: Number(layerId) }; }
function getLayerNameById(doc, layerId) {
    const id = Number(layerId);
    if (!Number.isFinite(id)) return "";
    if (layerNameCache.has(id)) return layerNameCache.get(id);
    const layer = findLayerByIdInDoc(doc, id);
    if (!layer) return "";
    try { return String(layer.name || ""); } catch (e) { return ""; }
}
function resolveKeyObjectFromDescriptor(doc, desc, currentIds) {
    const target = desc && desc._target && desc._target[0];
    if (!target) return null;
    if (target._id !== undefined) {
        const id = Number(target._id);
        if (Number.isFinite(id) && currentIds.indexOf(id) !== -1) return id;
    }
    if (target._name) {
        const matches = [];
        for (const id of currentIds) {
            const layer = findLayerByIdInDoc(doc, id);
            if (layer && String(layer.name) === String(target._name)) matches.push(id);
        }
        if (matches.length === 1) return matches[0];
    }
    return null;
}
function getFlatLayerOrder(doc) {
    const order = [];
    if (!doc) return order;
    function walk(layers) {
        if (!layers || !layers.length) return;
        for (const layer of layers) {
            const id = Number(layer.id);
            if (Number.isFinite(id)) order.push(id);
            try {
                const children = layer.layers;
                if (children && typeof children.length === "number" && children.length) walk(children);
            } catch (e) {}
        }
    }
    try { walk(doc.layers); } catch (e) {}
    return order;
}
function findFallbackKeyObjectAfterRemoval(doc, removedId, remainingIds) {
    const order = getFlatLayerOrder(doc);
    if (!order.length) return null;
    const idx = order.indexOf(Number(removedId));
    if (idx === -1) return null;
    const set = new Set((remainingIds || []).map(Number).filter(Number.isFinite));
    if (!set.size) return null;
    for (let i = idx - 1; i >= 0; i--) if (set.has(order[i])) return order[i];
    for (let i = idx + 1; i < order.length; i++) if (set.has(order[i])) return order[i];
    return null;
}
function onSelectNotification(event, descriptor) {
    try {
        if (isBusy) return;
        if (!descriptor) return;
        const currentIds = parseLayerIdField(descriptor.layerID);
        if (!currentIds.length) {
            lastKeyObjectId = null;
            lastSelectedIds = new Set();
            return;
        }
        const currentSet = new Set(currentIds);
        const mod = parseSelectionModifier(descriptor);
        const doc = app.activeDocument;
        if (mod === "removeFromSelection") {
            const removed = [];
            for (const id of lastSelectedIds) if (!currentSet.has(id)) removed.push(id);
            if (lastKeyObjectId !== null && removed.indexOf(Number(lastKeyObjectId)) !== -1) {
                let fb = doc ? findFallbackKeyObjectAfterRemoval(doc, lastKeyObjectId, currentIds) : null;
                if (fb === null && currentIds.length === 1) fb = currentIds[0];
                lastKeyObjectId = fb;
            }
            lastSelectedIds = currentSet;
            return;
        }
        if (mod === "intersectSelection") { lastSelectedIds = currentSet; return; }
        if (doc) {
            const keyId = resolveKeyObjectFromDescriptor(doc, descriptor, currentIds);
            if (keyId !== null) { lastKeyObjectId = keyId; lastSelectedIds = currentSet; return; }
        }
        if (mod === "addToSelection") {
            const added = currentIds.filter(id => !lastSelectedIds.has(id));
            if (added.length === 1) lastKeyObjectId = added[0];
            else if (added.length === 0) {}
            else lastKeyObjectId = null;
            lastSelectedIds = currentSet;
            return;
        }
        if (currentIds.length === 1) lastKeyObjectId = currentIds[0];
        else lastKeyObjectId = null;
        lastSelectedIds = currentSet;
    } catch (e) { console.error("[keyObject] 通知处理失败:", e); }
}


/* ---------- 图层基础 ---------- */

function getActiveDocument() { return app.activeDocument || null; }
function getDocSize(doc) {
    if (!doc) return null;
    const w = Number(doc.width), h = Number(doc.height);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { width: w, height: h };
}
function getCanvasBounds(doc) {
    return { left: 0, top: 0, right: Number(doc.width), bottom: Number(doc.height) };
}
function getSelectedLayers(doc) { return doc ? Array.from(doc.activeLayers || []) : []; }
function isGroupLayer(layer) {
    if (!layer) return false;
    if (layer.typename === "LayerSet") return true;
    try {
        const c = layer.layers;
        if (c !== null && c !== undefined && typeof c.length === "number") return true;
    } catch (e) {}
    return false;
}
function isBackgroundLayer(layer) {
    if (!layer) return false;
    try { if (layer.isBackgroundLayer === true) return true; } catch (e) {}
    return false;
}
function isPositionLocked(layer) {
    if (!layer) return false;
    try { if (layer.positionLocked === true) return true; } catch (e) {}
    try { if (layer.allLocked === true) return true; } catch (e) {}
    return false;
}
/* v63：新增第 6 重检测 */
function isAdjustmentLayer(layer) {
    if (!layer) return false;
    try { const a = layer.adjustment; if (a !== undefined && a !== null) return true; } catch (e) {}
    try { if (layer.isAdjustmentLayer === true) return true; } catch (e) {}
    try { if (String(layer.typename || "").indexOf("Adjustment") !== -1) return true; } catch (e) {}
    try {
        const k = Number(layer.kind);
        if (Number.isFinite(k) && ADJUSTMENT_KIND_NUMBERS.has(k)) return true;
    } catch (e) {}
    try {
        const s = String(layer.kind || "").toLowerCase().replace(/[^a-z]/g, "");
        if (s && ADJUSTMENT_KIND_STRINGS.has(s)) return true;
        if (s.indexOf("adjustment") !== -1) return true;
    } catch (e) {}
    try { if (layer.adjustmentData !== undefined && layer.adjustmentData !== null) return true; } catch (e) {}
    try { if (layer.adjustmentSettings !== undefined && layer.adjustmentSettings !== null) return true; } catch (e) {}
    return false;
}
function isUnitAllBackground(unit) {
    if (!unit || !unit.layers || !unit.layers.length) return false;
    for (const l of unit.layers) if (!isBackgroundLayer(l)) return false;
    return true;
}
function collectAllLeaves(layer) {
    const result = [];
    if (!layer) return result;
    if (isGroupLayer(layer)) {
        let children = null;
        try { children = layer.layers; } catch (e) { return result; }
        if (children && children.length) {
            for (const c of children) {
                const sub = collectAllLeaves(c);
                for (const s of sub) result.push(s);
            }
        }
        return result;
    }
    if (!isBackgroundLayer(layer)) result.push(layer);
    return result;
}
function buildLayerIndex(doc) {
    const idToLayer = new Map();
    const idToParentGroupId = new Map();
    const groupIds = new Set();
    const adjustmentIds = new Set();
    function walk(layers, parentGroupId) {
        if (!layers || !layers.length) return;
        for (const layer of layers) {
            const id = Number(layer.id);
            if (!Number.isFinite(id)) continue;
            idToLayer.set(id, layer);
            idToParentGroupId.set(id, parentGroupId);
            if (isAdjustmentLayer(layer)) adjustmentIds.add(id);
            let children = null, isGroup = false;
            if (layer.typename === "LayerSet") isGroup = true;
            try {
                const c = layer.layers;
                if (c !== null && c !== undefined && typeof c.length === "number") {
                    isGroup = true;
                    children = c;
                }
            } catch (e) {}
            if (isGroup) {
                groupIds.add(id);
                if (children && children.length) walk(children, id);
            }
        }
    }
    try { walk(doc.layers, null); } catch (e) { console.error("buildLayerIndex failed:", e); }
    if (LINK_DEBUG) console.log("[buildLayerIndex] 调整层:", Array.from(adjustmentIds), "组:", Array.from(groupIds));
    return { idToLayer, idToParentGroupId, groupIds, adjustmentIds };
}


/* ---------- bounds ---------- */

function getGroupBounds(group) {
    if (!group) return null;
    let children;
    try { children = group.layers; } catch (e) { return null; }
    if (!children || !children.length) return null;
    const list = [];
    for (const child of children) {
        if (isAdjustmentLayer(child)) continue;
        let b;
        try { b = getLayerBounds(child); } catch (e) { continue; }
        if (isValidBounds(b) && !isEmptyBounds(b)) list.push(b);
    }
    if (!list.length) return null;
    return getUnionBounds(list);
}
function getLayerBounds(layer) {
    if (!layer) return null;
    if (isGroupLayer(layer)) return getGroupBounds(layer);
    let b = null;
    try { b = layer.boundsNoEffects; }
    catch (e) { try { b = layer.bounds; } catch (e2) { return null; } }
    if (!b) return null;
    return { left: Number(b.left), top: Number(b.top), right: Number(b.right), bottom: Number(b.bottom) };
}
function isValidBounds(b) {
    return b && Number.isFinite(b.left) && Number.isFinite(b.top)
        && Number.isFinite(b.right) && Number.isFinite(b.bottom)
        && b.right >= b.left && b.bottom >= b.top;
}
function isEmptyBounds(b) {
    if (!isValidBounds(b)) return true;
    return (b.right - b.left === 0) || (b.bottom - b.top === 0);
}
function getUnionBounds(list) {
    if (!list || !list.length) return null;
    return {
        left: Math.min(...list.map(b => b.left)),
        top: Math.min(...list.map(b => b.top)),
        right: Math.max(...list.map(b => b.right)),
        bottom: Math.max(...list.map(b => b.bottom))
    };
}


/* ---------- 选择集 ---------- */

async function selectOnlyLayerById(layerId) {
    const id = Number(layerId);
    if (!Number.isFinite(id)) throw new Error("Invalid layer id");
    await runBatchPlay([{
        _obj: "select",
        _target: [makeSelectTarget(id)],
        makeVisible: false,
        _options: { dialogOptions: "dontDisplay" }
    }]);
}
function buildSelectDescriptors(ids, doc) {
    const descs = [];
    const accum = [];
    for (let i = 0; i < ids.length; i++) {
        const id = Number(ids[i]);
        if (!Number.isFinite(id)) continue;
        const name = getLayerNameById(doc, id);
        accum.unshift(id);
        const d = {
            _obj: "select",
            _target: [{ _name: name, _ref: "layer" }],
            layerID: accum.slice(),
            makeVisible: false,
            _options: { dialogOptions: "dontDisplay" }
        };
        if (i > 0) d.selectionModifier = { _enum: "selectionModifierType", _value: "addToSelection" };
        descs.push(d);
    }
    return descs;
}
async function selectAndLinkLayers(ids, doc) {
    if (!ids || !ids.length) return;
    const d = buildSelectDescriptors(ids, doc);
    if (!d.length) return;
    d.push({ _obj: "linkSelectedLayers", _target: [{ _enum: "ordinal", _ref: "layer" }] });
    await runBatchPlay(d);
}
async function selectAndUnlinkLayers(ids, doc) {
    if (!ids || !ids.length) return;
    const d = buildSelectDescriptors(ids, doc);
    if (!d.length) return;
    d.push({ _obj: "unlinkSelectedLayers", _target: [{ _enum: "ordinal", _ref: "layer" }] });
    await runBatchPlay(d);
}
async function selectLayers(layerIds) {
    if (!layerIds || !layerIds.length) return;
    const ids = layerIds.map(Number).filter(Number.isFinite);
    if (!ids.length) return;
    const d = buildSelectDescriptors(ids, app.activeDocument);
    if (!d.length) return;
    await runBatchPlay(d);
}


/* ---------- 锁定状态 ---------- */

async function readLayerLockingState(layerId) {
    try {
        const r = await runBatchPlay([{
            _obj: "get",
            _target: [{ _ref: "layer", _id: Number(layerId) }],
            _options: { dialogOptions: "dontDisplay" }
        }]);
        if (!r || !r[0]) return null;
        const d = r[0];
        const l = d.layerLocking || d.layerLockingV2;
        if (!l) return null;
        const c = {};
        for (const k in l) if (Object.prototype.hasOwnProperty.call(l, k)) c[k] = l[k];
        return c;
    } catch (e) { return null; }
}
async function applyLayerLocking(d) {
    await runBatchPlay([{
        _obj: "applyLocking",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        layerLocking: d
    }]);
}
async function setLayerLocking(id, d) {
    await runBatchPlay([{
        _obj: "set",
        _target: [{ _ref: "property", _property: "layerLocking" }, { _ref: "layer", _id: Number(id) }],
        to: d
    }]);
}
function makeUnlockedLocking(orig) {
    const n = {
        _obj: "layerLocking",
        protectAll: false, protectPosition: false,
        protectComposite: false, protectTransparency: false
    };
    if (orig && orig.protectArtboardAutonest !== undefined) n.protectArtboardAutonest = !!orig.protectArtboardAutonest;
    return n;
}
async function unlockUnitLockedLayers(unit, prefix) {
    const checkList = [];
    const seen = new Set();
    function add(l) {
        if (!l) return;
        const id = Number(l.id);
        if (!Number.isFinite(id) || seen.has(id)) return;
        seen.add(id); checkList.push(l);
    }
    for (const l of unit.layers) {
        add(l);
        if (isGroupLayer(l)) for (const x of collectAllLeaves(l)) add(x);
    }
    const saved = [];
    for (const l of checkList) {
        if (isBackgroundLayer(l) || isAdjustmentLayer(l)) continue;
        if (!isPositionLocked(l)) continue;
        const id = Number(l.id);
        try {
            await selectOnlyLayerById(id);
            const s = await readLayerLockingState(id);
            if (!s) continue;
            const u = makeUnlockedLocking(s);
            try { await applyLayerLocking(u); } catch (e) { await setLayerLocking(id, u); }
            saved.push({ layer: l, savedLocking: s });
        } catch (e) { console.warn(prefix + " 解锁失败:", id, e); }
    }
    return { checkList, savedLockings: saved };
}
async function restoreUnitLockings(saved, prefix) {
    for (const it of saved) {
        const id = Number(it.layer.id);
        try {
            await selectOnlyLayerById(id);
            try { await applyLayerLocking(it.savedLocking); }
            catch (e) { await setLayerLocking(id, it.savedLocking); }
        } catch (e) { console.error(prefix + " 恢复锁定失败:", id, e); }
    }
}


/* ---------- 移动 ---------- */

async function moveLayerBy(layerId, dx, dy) {
    const id = Number(layerId);
    if (!Number.isFinite(id)) throw new Error("Invalid layer id");
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error("Invalid translation");
    await runBatchPlay([{
        _obj: "move",
        _target: [{ _ref: "layer", _id: id }],
        to: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: dx }, vertical: { _unit: "pixelsUnit", _value: dy } }
    }]);
}
async function moveSelectionBy(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error("Invalid translation");
    await runBatchPlay([{
        _obj: "move",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        to: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: dx }, vertical: { _unit: "pixelsUnit", _value: dy } }
    }]);
}
function needsMove(dx, dy) {
    return Math.abs(dx) >= MIN_MOVE_EPSILON || Math.abs(dy) >= MIN_MOVE_EPSILON;
}


/* ---------- prepareAndMoveUnit ---------- */

async function prepareAndMoveUnit(unit, dx, dy) {
    if (!unit || !unit.layers || !unit.layers.length) return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error("Invalid translation");
    if (LINK_DEBUG) {
        console.log("[prepareAndMoveUnit] unit 开始:",
            "层数=" + unit.layers.length, "dx=" + dx, "dy=" + dy,
            "模式=" + (activeLinkPairs && activeLinkPairs.length ? "跟随" : "逐个"),
            "层=" + unit.layers.map(l => l.id + ":" + (l.name || "")).join("|"));
    }
    const { savedLockings } = await unlockUnitLockedLayers(unit, "[prepareAndMoveUnit]");
    let moveError = null;
    try {
        if (activeLinkPairs && activeLinkPairs.length) {
            const memberIds = [];
            for (const m of unit.layers) {
                if (isAdjustmentLayer(m)) continue;
                if (isBackgroundLayer(m)) continue;
                const id = Number(m.id);
                if (!Number.isFinite(id)) continue;
                memberIds.push(id);
            }
            if (LINK_DEBUG) console.log("[prepareAndMoveUnit] 跟随模式，选择集=" + memberIds.join(","));
            if (memberIds.length) {
                await selectLayers(memberIds);
                await moveSelectionBy(dx, dy);
            }
        } else {
            for (const layer of unit.layers) {
                if (isAdjustmentLayer(layer)) continue;
                if (isBackgroundLayer(layer)) continue;
                const id = Number(layer.id);
                if (!Number.isFinite(id)) continue;
                await selectOnlyLayerById(id);
                await moveLayerBy(id, dx, dy);
            }
        }
    } catch (e) { moveError = e; }
    await restoreUnitLockings(savedLockings, "[prepareAndMoveUnit]");
    if (moveError) throw moveError;
}


/* ---------- 顶部功能：v61 迭代缩放 ---------- */

function computeScalePercent(mode, w, h, cw, ch) {
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("Invalid layer size");
    if (w <= 0 || h <= 0) throw new Error("Cannot compute valid bounds for current object");
    let px, py;
    if (mode === "fitCanvas") { px = (cw / w) * 100; py = (ch / h) * 100; }
    else if (mode === "fitHeight") { const s = (ch / h) * 100; px = s; py = s; }
    else if (mode === "fitWidth") { const s = (cw / w) * 100; px = s; py = s; }
    else throw new Error("Unknown fit mode");
    if (!Number.isFinite(px) || !Number.isFinite(py) || px <= 0 || py <= 0) throw new Error("Cannot compute valid scale");
    return { percentX: px, percentY: py };
}

/* v61：判断当前尺寸是否已达标（像素容差 0.5） */
function isFitTargetReached(mode, lw, lh, cw, ch) {
    const tol = FIT_PIXEL_TOLERANCE;
    if (mode === "fitCanvas") return Math.abs(lw - cw) < tol && Math.abs(lh - ch) < tol;
    if (mode === "fitHeight") return Math.abs(lh - ch) < tol;
    if (mode === "fitWidth")  return Math.abs(lw - cw) < tol;
    return false;
}

/* v63：计算当前与目标的像素差距（用于振荡检测） */
function computeFitGap(mode, lw, lh, cw, ch) {
    if (mode === "fitCanvas") return Math.max(Math.abs(lw - cw), Math.abs(lh - ch));
    if (mode === "fitHeight") return Math.abs(lh - ch);
    if (mode === "fitWidth")  return Math.abs(lw - cw);
    return Infinity;
}

/* v61 迭代缩放 + v63 振荡检测 */
async function fitSingleLayer(doc, layer, mode, cw, ch) {
    if (!layer || isBackgroundLayer(layer) || isAdjustmentLayer(layer)) return;
    const id = Number(layer.id);
    if (!Number.isFinite(id)) return;

    let prevGap = Infinity;

    for (let iter = 0; iter < FIT_MAX_ITERATIONS; iter++) {
        if (abortRequested) return;

        let ob;
        try { ob = getLayerBounds(layer); } catch (e) { ob = null; }
        if (!isValidBounds(ob) || isEmptyBounds(ob)) throw new Error("Cannot compute valid bounds for current object");
        const lw = ob.right - ob.left;
        const lh = ob.bottom - ob.top;

        const gap = computeFitGap(mode, lw, lh, cw, ch);

        if (iter > 0) {
            if (gap >= prevGap - FIT_OSCILLATION_TOLERANCE) {
                if (LINK_DEBUG) {
                    console.log("[fitSingleLayer] id=" + id + " 迭代 " + iter
                        + " 差距未继续减小 (gap=" + gap.toFixed(3)
                        + " prevGap=" + prevGap.toFixed(3) + ")，停止");
                }
                break;
            }
            if (isFitTargetReached(mode, lw, lh, cw, ch)) {
                if (LINK_DEBUG) {
                    console.log("[fitSingleLayer] id=" + id + " 迭代 " + iter + " 后达标，停止");
                }
                break;
            }
        }
        prevGap = gap;

        const { percentX, percentY } = computeScalePercent(mode, lw, lh, cw, ch);

        if (LINK_DEBUG) {
            console.log("[fitSingleLayer] id=" + id + " 第 " + (iter + 1) + " 次缩放:",
                "当前 w=" + lw.toFixed(2), "h=" + lh.toFixed(2), "gap=" + gap.toFixed(3),
                "→ percentX=" + percentX.toFixed(4) + "%", "percentY=" + percentY.toFixed(4) + "%");
        }

        await selectOnlyLayerById(id);
        try {
            await layer.scale(percentX, percentY, constants.AnchorPosition.MIDDLECENTER);
        } catch (e) {
            console.error("[fitSingleLayer] scale 失败:", id, e);
            throw e;
        }
    }

    let nb;
    try { nb = getLayerBounds(layer); } catch (e) { nb = null; }
    if (!isValidBounds(nb) || isEmptyBounds(nb)) throw new Error("Cannot compute valid bounds after scaling");
    const nw = nb.right - nb.left, nh = nb.bottom - nb.top;
    const dx = (cw - nw) / 2 - nb.left;
    const dy = (ch - nh) / 2 - nb.top;
    if (LINK_DEBUG) {
        console.log("[fitSingleLayer] id=" + id + " 最终居中:",
            "w=" + nw.toFixed(2), "h=" + nh.toFixed(2), "dx=" + dx.toFixed(2), "dy=" + dy.toFixed(2));
    }
    if (needsMove(dx, dy)) {
        await selectOnlyLayerById(id);
        await moveLayerBy(id, dx, dy);
    }
}

function getUnitCommonParentGroup(unit, index) {
    if (!unit || !unit.layers || unit.layers.length < 2 || !index) return null;
    const parentIds = new Set();
    for (const l of unit.layers) {
        const id = Number(l.id);
        if (!Number.isFinite(id)) return null;
        const pid = index.idToParentGroupId.get(id);
        if (pid === null || pid === undefined) return null;
        parentIds.add(pid);
    }
    if (parentIds.size !== 1) return null;
    const pg = index.idToLayer.get([...parentIds][0]);
    if (!pg) return null;
    let children;
    try { children = pg.layers; } catch (e) { return null; }
    if (!children || !children.length) return null;
    const unitIds = new Set(unit.layers.map(l => Number(l.id)));
    for (const c of children) {
        const cid = Number(c.id);
        if (unitIds.has(cid)) continue;
        if (isAdjustmentLayer(c)) continue;
        return null;
    }
    return pg;
}
async function prepareAndFitUnit(doc, unit, mode, cw, ch, index) {
    if (!unit || !unit.layers || !unit.layers.length) return;
    const { savedLockings } = await unlockUnitLockedLayers(unit, "[prepareAndFitUnit]");
    let err = null;
    try {
        if (unit.layers.length === 1) {
            await fitSingleLayer(doc, unit.layers[0], mode, cw, ch);
        } else {
            const cp = getUnitCommonParentGroup(unit, index);
            if (cp) await fitSingleLayer(doc, cp, mode, cw, ch);
            else for (const l of unit.layers) {
                if (isAdjustmentLayer(l)) continue;
                await fitSingleLayer(doc, l, mode, cw, ch);
            }
        }
    } catch (e) { err = e; }
    await restoreUnitLockings(savedLockings, "[prepareAndFitUnit]");
    if (err) throw err;
}


/* ---------- 真实像素边界 ---------- */

async function getRealPixelBounds(doc, layer, bounds) {
    if (!imaging || typeof imaging.getPixels !== "function") return null;
    if (isGroupLayer(layer) || isBackgroundLayer(layer) || isAdjustmentLayer(layer)) return null;
    const w = Math.ceil(bounds.right - bounds.left);
    const h = Math.ceil(bounds.bottom - bounds.top);
    if (w <= 0 || h <= 0 || w * h > MAX_PIXEL_SCAN_AREA) return null;
    let img;
    try {
        img = await imaging.getPixels({
            documentID: doc.id, layerID: Number(layer.id),
            sourceBounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
            componentSize: 8, colorSpace: "RGB"
        });
    } catch (e) { return null; }
    if (!img || !img.imageData) return null;
    const W = Number(img.imageData.width), H = Number(img.imageData.height);
    if (!W || !H) return null;
    let data;
    try { data = await img.imageData.getData(); } catch (e) { return null; }
    if (!data || data.length < W * H * 4) return null;
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) {
        const base = y * W * 4;
        for (let x = 0; x < W; x++) {
            const a = data[base + x * 4 + 3];
            if (a > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return null;
    return {
        left: bounds.left + minX, top: bounds.top + minY,
        right: bounds.left + maxX + 1, bottom: bounds.top + maxY + 1
    };
}


/* ---------- 操作单位 ---------- */

function collectUnitsIgnoringGroups(doc, layers, index) {
    const leafIds = new Set();
    function collectLeaves(group) {
        let c = null;
        try { c = group.layers; } catch (e) { return; }
        if (!c || !c.length) return;
        for (const x of c) {
            const id = Number(x.id);
            if (!Number.isFinite(id)) continue;
            if (index.adjustmentIds.has(id)) continue;
            if (isAdjustmentLayer(x)) continue;
            if (index.groupIds.has(id)) collectLeaves(x);
            else leafIds.add(id);
        }
    }
    for (const l of layers) {
        const id = Number(l.id);
        if (!Number.isFinite(id)) continue;
        if (index.adjustmentIds.has(id)) continue;
        if (isAdjustmentLayer(l)) continue;
        if (index.groupIds.has(id)) {
            const g = index.idToLayer.get(id);
            if (g) collectLeaves(g);
        } else leafIds.add(id);
    }
    const units = [];
    for (const id of leafIds) {
        const leaf = index.idToLayer.get(id);
        if (!leaf) continue;
        let b;
        try { b = getLayerBounds(leaf); } catch (e) { continue; }
        if (!isValidBounds(b) || isEmptyBounds(b)) continue;
        units.push({ layers: [leaf], bounds: b });
    }
    if (LINK_DEBUG) console.log("[collectUnits] 忽略组模式，units=",
        units.map(u => u.layers.map(l => l.id + ":" + (l.name || "")).join("|")));
    return units;
}
function collectUnitsWithGroups(doc, layers, index) {
    const selectedIds = new Set(layers.map(l => Number(l.id)).filter(Number.isFinite));
    function findNearest(oId) {
        let cur = index.idToParentGroupId.get(oId);
        while (cur !== null && cur !== undefined) {
            if (selectedIds.has(cur) && index.groupIds.has(cur)) return index.idToLayer.get(cur);
            cur = index.idToParentGroupId.get(cur);
        }
        return null;
    }
    const indepG = [], topLeaf = [], buckets = new Map();
    for (const obj of layers) {
        const id = Number(obj.id);
        if (!Number.isFinite(id)) continue;
        if (index.adjustmentIds.has(id)) continue;
        if (isAdjustmentLayer(obj)) continue;
        const full = index.idToLayer.get(id);
        if (!full) continue;
        if (findNearest(id)) continue;
        if (index.groupIds.has(id)) indepG.push(full);
        else {
            const pid = index.idToParentGroupId.get(id);
            if (pid === null || pid === undefined) topLeaf.push(full);
            else {
                if (!buckets.has(pid)) buckets.set(pid, []);
                buckets.get(pid).push(full);
            }
        }
    }
    const units = [];
    for (const g of indepG) {
        const b = getGroupBounds(g);
        if (!isValidBounds(b) || isEmptyBounds(b)) continue;
        units.push({ layers: [g], bounds: b });
    }
    for (const [, leaves] of buckets) {
        const bl = [], valid = [];
        for (const l of leaves) {
            let b;
            try { b = getLayerBounds(l); } catch (e) { continue; }
            if (!isValidBounds(b) || isEmptyBounds(b)) continue;
            bl.push(b); valid.push(l);
        }
        if (!bl.length) continue;
        const u = getUnionBounds(bl);
        if (!u || !isValidBounds(u)) continue;
        units.push({ layers: valid, bounds: u });
    }
    for (const l of topLeaf) {
        let b;
        try { b = getLayerBounds(l); } catch (e) { continue; }
        if (!isValidBounds(b) || isEmptyBounds(b)) continue;
        units.push({ layers: [l], bounds: b });
    }
    if (LINK_DEBUG) console.log("[collectUnits] 按组模式，units=",
        units.map(u => u.layers.map(l => l.id + ":" + (l.name || "")).join("|")));
    return units;
}
function collectOperationUnits(doc, layers, alignByGroup, index) {
    if (!layers || !layers.length) return [];
    const idx = index || buildLayerIndex(doc);
    let units = alignByGroup ? collectUnitsWithGroups(doc, layers, idx) : collectUnitsIgnoringGroups(doc, layers, idx);
    return (units || []).filter(u => !isUnitAllBackground(u));
}


/* ---------- 单位包含 ---------- */

function layerTreeContainsId(layer, targetId) {
    if (!layer) return false;
    const id = Number(targetId);
    if (!Number.isFinite(id)) return false;
    if (Number(layer.id) === id) return true;
    try {
        const c = layer.layers;
        if (c && typeof c.length === "number" && c.length) {
            for (const x of c) if (layerTreeContainsId(x, id)) return true;
        }
    } catch (e) {}
    return false;
}
function unitContainsLayer(unit, layerId) {
    if (!unit || !unit.layers || !unit.layers.length) return false;
    const id = Number(layerId);
    if (!Number.isFinite(id)) return false;
    for (const l of unit.layers) if (layerTreeContainsId(l, id)) return true;
    return false;
}
function collectAllLayerIdsInUnit(unit) {
    const ids = [];
    if (!unit || !unit.layers || !unit.layers.length) return ids;
    function walk(l) {
        const id = Number(l.id);
        if (!Number.isFinite(id)) return;
        ids.push(id);
        if (isGroupLayer(l)) {
            let c = null;
            try { c = l.layers; } catch (e) { return; }
            if (c && c.length) for (const x of c) walk(x);
        }
    }
    for (const l of unit.layers) walk(l);
    return ids;
}


/* ---------- 单位真实像素边界 ---------- */

function collectUnitLeafLayers(unit, index) {
    const result = [];
    function walk(l) {
        const id = Number(l.id);
        if (index.groupIds.has(id)) {
            let c = null;
            try { c = l.layers; } catch (e) { return; }
            if (c && c.length) for (const x of c) walk(x);
        } else result.push(l);
    }
    for (const l of unit.layers) walk(l);
    return result;
}
async function getUnitRealPixelBounds(doc, unit, index) {
    const leaves = collectUnitLeafLayers(unit, index);
    if (!leaves.length) return null;
    let union = null;
    for (const leaf of leaves) {
        if (isBackgroundLayer(leaf) || isAdjustmentLayer(leaf)) continue;
        let b;
        try { b = getLayerBounds(leaf); } catch (e) { continue; }
        if (!isValidBounds(b) || isEmptyBounds(b)) continue;
        let real = null;
        try { real = await getRealPixelBounds(doc, leaf, b); } catch (e) {}
        if (!real) real = b;
        if (!union) union = { ...real };
        else union = {
            left: Math.min(union.left, real.left),
            top: Math.min(union.top, real.top),
            right: Math.max(union.right, real.right),
            bottom: Math.max(union.bottom, real.bottom)
        };
    }
    return union;
}


/* ---------- 链接处理 ---------- */

function collectAllLeafIdsForUnits(units, index) {
    const ids = new Set();
    if (!units || !units.length || !index) return [];
    function walk(l) {
        const id = Number(l.id);
        if (!Number.isFinite(id)) return;
        if (index.groupIds.has(id)) {
            let c = null;
            try { c = l.layers; } catch (e) { return; }
            if (c && c.length) for (const x of c) walk(x);
        } else {
            if (index.adjustmentIds.has(id)) return;
            if (isAdjustmentLayer(l)) return;
            ids.add(id);
        }
    }
    for (const u of units) if (u && u.layers) for (const l of u.layers) walk(l);
    return Array.from(ids);
}
function groupLinksIntoComponents(linkPairs) {
    if (!linkPairs || !linkPairs.length) return [];
    const parent = new Map();
    function find(x) {
        if (!parent.has(x)) parent.set(x, x);
        let p = parent.get(x);
        while (p !== x) {
            const gp = parent.get(p);
            if (gp === p) break;
            parent.set(x, gp);
            x = p; p = gp;
        }
        return p;
    }
    function union(a, b) {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    }
    for (const p of linkPairs) {
        const a = Number(p.a), b = Number(p.b);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        union(a, b);
    }
    const groups = new Map();
    for (const key of parent.keys()) {
        const r = find(key);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push(key);
    }
    return Array.from(groups.values());
}
function getLayerLinkedLayers(layer) {
    if (!layer) return null;
    try {
        const arr = layer.linkedLayers;
        if (arr === null || arr === undefined) return null;
        if (typeof arr.length !== "number") return null;
        const out = [];
        for (let i = 0; i < arr.length; i++) out.push(arr[i]);
        return out;
    } catch (e) { return null; }
}
function extractLinkedId(l) {
    if (!l) return null;
    try {
        let n = Number(l.id);
        if (Number.isFinite(n)) return n;
    } catch (e) {}
    try {
        let n = Number(l._id);
        if (Number.isFinite(n)) return n;
    } catch (e) {}
    return null;
}
async function readLinkPairsViaDOM(doc, candidateIds) {
    if (!candidateIds || !candidateIds.length) return [];
    const links = new Map();
    let ok = 0, miss = 0;
    for (const lid of candidateIds) {
        const layer = findLayerByIdInDoc(doc, lid);
        if (!layer) { miss++; continue; }
        const linked = getLayerLinkedLayers(layer);
        if (linked === null) { miss++; continue; }
        ok++;
        for (const l of linked) {
            const l2 = extractLinkedId(l);
            if (l2 === null || l2 === lid) continue;
            if (!links.has(lid)) links.set(lid, new Set());
            links.get(lid).add(l2);
            if (!links.has(l2)) links.set(l2, new Set());
            links.get(l2).add(lid);
        }
    }
    if (LINK_DEBUG) console.log("[readLinkPairsViaDOM] 成功=" + ok + " 失败=" + miss + " 关联=" + links.size);
    if (ok === 0) return null;
    if (miss > ok) {
        if (LINK_DEBUG) console.log("[readLinkPairsViaDOM] 失败过多 (" + miss + " > " + ok + ")，回退到探测法");
        return null;
    }
    const pairs = [];
    const seen = new Set();
    for (const [a, sb] of links) {
        for (const b of sb) {
            const k = a < b ? a + ":" + b : b + ":" + a;
            if (seen.has(k)) continue;
            seen.add(k);
            pairs.push({ a, b });
        }
    }
    return pairs;
}

async function detectLinkPairs(doc, leafIds) {
    const pairs = [];
    const init = new Map();
    for (const id of leafIds) {
        const layer = findLayerByIdInDoc(doc, id);
        if (!layer) continue;
        let b;
        try { b = getLayerBounds(layer); } catch (e) {}
        if (isValidBounds(b)) init.set(id, { left: b.left, top: b.top });
    }

    const probed = new Set();
    let probeCount = 0;

    for (const a of leafIds) {
        if (probed.has(a)) continue;
        probed.add(a);
        if (!init.has(a)) continue;

        probeCount++;
        const memberLinks = [];
        try {
            await selectOnlyLayerById(a);
            await moveLayerBy(a, LINK_DETECT_DELTA, 0);
        } catch (e) {
            continue;
        }
        try {
            for (const b of leafIds) {
                if (b === a || !init.has(b)) continue;
                const bl = findLayerByIdInDoc(doc, b);
                if (!bl) continue;
                let bb;
                try { bb = getLayerBounds(bl); } catch (e) { continue; }
                if (!isValidBounds(bb)) continue;
                const bi = init.get(b);
                if (Math.abs((bb.left - bi.left) - LINK_DETECT_DELTA) < LINK_DETECT_TOLERANCE) {
                    pairs.push({ a, b });
                    memberLinks.push(b);
                }
            }
        } finally {
            try { await moveLayerBy(a, -LINK_DETECT_DELTA, 0); } catch (e) {}
        }
        for (const m of memberLinks) probed.add(m);
    }

    const uniq = [];
    const seen = new Set();
    for (const p of pairs) {
        const k = p.a < p.b ? p.a + ":" + p.b : p.b + ":" + p.a;
        if (!seen.has(k)) { seen.add(k); uniq.push(p); }
    }
    if (LINK_DEBUG) console.log("[detectLinkPairs] 链接对数:", uniq.length,
        "探测次数:", probeCount, "/", leafIds.length,
        "对:", uniq.map(p => p.a + "-" + p.b).join(", "));
    return uniq;
}
function mergeUnitsByLinks(units, linkPairs, adjustmentIds, idToLayer, ignoreAdjustment) {
    if (!linkPairs.length || !units.length) return units;
    const unitList = units.map(u => ({ layers: u.layers.slice(), bounds: u.bounds ? { ...u.bounds } : null }));
    const layerToUnit = new Map();
    for (let i = 0; i < unitList.length; i++) {
        for (const id of collectAllLayerIdsInUnit(unitList[i])) layerToUnit.set(id, i);
    }
    const parent = unitList.map((_, i) => i);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    for (const pair of linkPairs) {
        const a = Number(pair.a), b = Number(pair.b);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        const la = idToLayer.get(a), lb = idToLayer.get(b);
        if (!la || !lb) continue;
        const aAdj = adjustmentIds.has(a), bAdj = adjustmentIds.has(b);
        if (aAdj && bAdj) continue;
        if (aAdj && !bAdj) {
            if (ignoreAdjustment) continue;
            const ub = layerToUnit.get(b);
            if (ub !== undefined) { unitList[ub].layers.push(la); layerToUnit.set(a, ub); }
            continue;
        }
        if (!aAdj && bAdj) {
            if (ignoreAdjustment) continue;
            const ua = layerToUnit.get(a);
            if (ua !== undefined) { unitList[ua].layers.push(lb); layerToUnit.set(b, ua); }
            continue;
        }
        let ua = layerToUnit.get(a), ub = layerToUnit.get(b);
        if (ua === undefined && ub === undefined) {
            const n = unitList.length;
            unitList.push({ layers: [la, lb], bounds: null });
            parent.push(n);
            layerToUnit.set(a, n); layerToUnit.set(b, n);
        } else if (ua !== undefined && ub === undefined) {
            unitList[ua].layers.push(lb); layerToUnit.set(b, ua);
        } else if (ua === undefined && ub !== undefined) {
            unitList[ub].layers.push(la); layerToUnit.set(a, ub);
        } else if (ua !== ub) union(ua, ub);
    }
    const groups = new Map();
    for (let i = 0; i < unitList.length; i++) {
        const r = find(i);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push(i);
    }
    const merged = [];
    for (const [, indices] of groups) {
        const seen = new Set();
        const layers = [];
        for (const i of indices) for (const l of unitList[i].layers) {
            const id = Number(l.id);
            if (!Number.isFinite(id) || seen.has(id)) continue;
            seen.add(id); layers.push(l);
        }
        if (!layers.length) continue;
        const bl = [];
        for (const l of layers) {
            if (isAdjustmentLayer(l) || isBackgroundLayer(l)) continue;
            let b;
            try { b = getLayerBounds(l); } catch (e) {}
            if (isValidBounds(b) && !isEmptyBounds(b)) bl.push(b);
        }
        let bounds = bl.length ? getUnionBounds(bl) : null;
        if (!bounds) for (const i of indices) if (unitList[i].bounds && isValidBounds(unitList[i].bounds)) { bounds = unitList[i].bounds; break; }
        merged.push({ layers, bounds });
    }
    if (LINK_DEBUG) console.log("[mergeUnitsByLinks] 合并前 units=" + unitList.length,
        "合并后=" + merged.length,
        "输出=" + merged.map(u => "[" + u.layers.map(l => l.id).join(",") + "]").join(" "),
        "ignoreAdj=" + !!ignoreAdjustment);
    return merged;
}
async function runWithLinkAwareness(doc, units, adjustmentLayers, executor) {
    if (!units || !units.length) return await executor(units);
    let index;
    try { index = buildLayerIndex(doc); } catch (e) { return await executor(units); }
    const nonAdjLeafIds = collectAllLeafIdsForUnits(units, index);
    const allAdjIds = Array.from(index.adjustmentIds);
    const candidateIds = nonAdjLeafIds.slice();
    for (const aid of allAdjIds) if (candidateIds.indexOf(aid) === -1) candidateIds.push(aid);
    const originalSelectionIds = getSelectedLayers(doc).map(l => Number(l.id)).filter(Number.isFinite);

    let linkPairs = [], usedDOM = false;
    if (candidateIds.length >= 2) {
        try {
            const dp = await readLinkPairsViaDOM(doc, candidateIds);
            if (dp !== null) {
                linkPairs = dp; usedDOM = true;
                if (LINK_DEBUG) console.log("[link] DOM 读取链接成功，链接对数:", linkPairs.length,
                    "对:", linkPairs.map(p => p.a + "-" + p.b).join(", "));
            }
        } catch (e) {}
        if (!usedDOM) {
            console.log("[link] DOM 读取不可用，降级到探测法");
            try { linkPairs = await detectLinkPairs(doc, candidateIds); } catch (e) { linkPairs = []; }
        }
    }

    const ignoreLink = isIgnoreLink();
    const ignoreAdj = isIgnoreAdjustment();

    let finalUnits = units, unlinked = false, groupsToRestore = [];
    if (!ignoreLink && linkPairs.length) {
        activeLinkPairs = linkPairs;
        try {
            finalUnits = mergeUnitsByLinks(units, linkPairs, index.adjustmentIds, index.idToLayer, ignoreAdj);
            console.log("[link] 跟随模式：合并 units（不断链） units=" + finalUnits.length
                + " linkPairs=" + linkPairs.length + " ignoreAdj=" + ignoreAdj);
        } catch (e) { finalUnits = units; activeLinkPairs = []; }
    } else {
        activeLinkPairs = [];
        const groups = groupLinksIntoComponents(linkPairs);
        if (groups.length) {
            try {
                for (const g of groups) await selectAndUnlinkLayers(g, doc);
                unlinked = true;
                groupsToRestore = groups;
                console.log("[link] 忽略模式：已临时断链，组数:", groups.length);
            } catch (e) {}
        }
    }
    if (originalSelectionIds.length) { try { await selectLayers(originalSelectionIds); } catch (e) {} }
    try { await executor(finalUnits); }
    finally {
        if (unlinked) {
            for (const g of groupsToRestore) {
                try { await selectAndLinkLayers(g, doc); } catch (e) {}
            }
            console.log("[link] 忽略模式：链接已恢复，组数:", groupsToRestore.length);
        }
        activeLinkPairs = [];
        if (originalSelectionIds.length) { try { await selectLayers(originalSelectionIds); } catch (e) {} }
    }
}


/* ---------- History ---------- */

async function executeAsSingleHistoryStep(historyName, operation) {
    lastOperationAborted = false;
    lastAbortReason = "";
    const doc = app.activeDocument;
    if (!doc) throw new Error("No open document");
    refreshLayerNameCache(doc);
    try {
        await core.executeAsModal(async (ctx) => {
            const sid = await ctx.hostControl.suspendHistory({ documentID: doc.id, name: historyName });
            let err = null, userCancelled = false;
            try { await operation(ctx); } catch (e) { err = e; }
            if (err) {
                if (isUserCancelError(err)) { userCancelled = true; }
                else {
                    try { await ctx.hostControl.resumeHistory(sid, false); } catch (e2) {}
                    throw err;
                }
            }
            try { sid.finalName = historyName; await ctx.hostControl.resumeHistory(sid, true); } catch (e) {}
            if (userCancelled) { lastOperationAborted = true; lastAbortReason = "psCancel"; }
            else if (abortRequested) { lastOperationAborted = true; lastAbortReason = "esc"; }
        }, { commandName: historyName });
    } catch (outerError) {
        if (isUserCancelError(outerError)) {
            lastOperationAborted = true; lastAbortReason = "psCancel"; return;
        }
        throw outerError;
    }
}


/* ---------- 操作锁 ---------- */

async function runWithLock(label, operation) {
    if (isBusy) return;
    abortRequested = false;
    setBusy(true);
    try { await operation(); }
    catch (error) {
        console.error("[" + label + "] error:", error);
        if (isUserCancelError(error)) showToast(t("userCancelled"), "warning");
        else showToast(getLocalizedErrorMessage(error), "error");
    } finally {
        abortRequested = false;
        scheduleBusyRelease(BUSY_RELEASE_DELAY);
    }
}
function showOperationResult(msg) {
    if (lastOperationAborted) showToast(t("userCancelled"), "warning");
    else showToast(msg, "success");
}


/* ---------- 对齐 ---------- */

function getKeyObject(doc) {
    if (!doc) return null;
    if (lastKeyObjectId === null || lastKeyObjectId === undefined) return null;
    const id = Number(lastKeyObjectId);
    if (!Number.isFinite(id)) { lastKeyObjectId = null; return null; }
    const found = getSelectedLayers(doc).find(l => Number(l.id) === id);
    if (!found) { lastKeyObjectId = null; return null; }
    return found;
}
function getAlignTarget(doc, units, keyLayer) {
    if (!units || !units.length) return null;
    if (alignReference === "canvas") {
        const c = getCanvasBounds(doc);
        return isValidBounds(c) ? c : null;
    }
    if (alignReference === "selection") {
        const u = getUnionBounds(units.map(x => x.bounds).filter(isValidBounds));
        return u && isValidBounds(u) ? u : null;
    }
    if (alignReference === "keyObject") {
        if (!keyLayer) return null;
        const kid = Number(keyLayer.id);
        if (Number.isFinite(kid)) for (const u of units) if (unitContainsLayer(u, kid)) return u.bounds;
        const kb = getLayerBounds(keyLayer);
        return isValidBounds(kb) ? kb : null;
    }
    return null;
}
function buildAlignmentPlan(units, target, mode, keyLayer) {
    const plan = [];
    const kid = keyLayer ? Number(keyLayer.id) : null;
    for (const u of units) {
        if (Number.isFinite(kid) && unitContainsLayer(u, kid)) continue;
        const b = u.bounds;
        if (!isValidBounds(b)) continue;
        let dx = 0, dy = 0;
        switch (mode) {
            case "left":    dx = target.left - b.left; break;
            case "hcenter": dx = (target.left + target.right) / 2 - (b.left + b.right) / 2; break;
            case "right":   dx = target.right - b.right; break;
            case "top":     dy = target.top - b.top; break;
            case "vcenter": dy = (target.top + target.bottom) / 2 - (b.top + b.bottom) / 2; break;
            case "bottom":  dy = target.bottom - b.bottom; break;
            default: throw new Error("Unknown alignment mode");
        }
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error("Cannot compute alignment position");
        plan.push({ unit: u, dx, dy });
    }
    return plan;
}
async function executeAlignment(mode) {
    const hn = ALIGN_MODE_HISTORY_NAMES[mode];
    if (!hn) { showToast(t("unknownAlignMode"), "error"); return; }
    const doc = getActiveDocument();
    if (!doc) { showToast(t("noOpenDocument"), "warning"); return; }
    const layers = getSelectedLayers(doc);
    if (!layers.length) { showToast(t("noSelectedLayers"), "warning"); return; }
    const alignByGroup = isAlignByGroup();
    const nonAdj = layers.filter(l => !isAdjustmentLayer(l));
    if (!nonAdj.length) { showToast(t("onlyAdjustmentAlign"), "warning"); return; }
    const index = buildLayerIndex(doc);
    const units = collectOperationUnits(doc, nonAdj, alignByGroup, index);
    if (!units || !units.length) { showToast(t("noValidAlignObjects"), "warning"); return; }
    let keyLayer = null;
    if (alignReference === "keyObject") {
        keyLayer = getKeyObject(doc);
        if (!keyLayer) { showToast(t("cannotDetermineKeyObject"), "warning"); return; }
    } else {
        if (!getAlignTarget(doc, units, null)) { showToast(t("cannotDetermineTarget"), "error"); return; }
    }
    await executeAsSingleHistoryStep(hn, async () => {
        await runWithLinkAwareness(doc, units, [], async (fu) => {
            const target = getAlignTarget(doc, fu, keyLayer);
            if (!target) throw new Error("Cannot determine alignment target");
            const plan = buildAlignmentPlan(fu, target, mode, keyLayer);
            for (const it of plan) {
                if (abortRequested) break;
                if (!needsMove(it.dx, it.dy)) continue;
                await prepareAndMoveUnit(it.unit, it.dx, it.dy);
            }
        });
    });
    showOperationResult(tf("opCompleted", ALIGN_MODE_LABELS[mode]));
}


/* ---------- 分布 ---------- */

function makeDistItem(u) {
    const b = u.bounds;
    return { unit: u, left: b.left, right: b.right, top: b.top, bottom: b.bottom,
        centerX: (b.left + b.right) / 2, centerY: (b.top + b.bottom) / 2 };
}
function buildDistributionPlan(units, mode) {
    const cfg = DIST_MODE_CONFIG[mode];
    if (!cfg) throw new Error("Unknown distribution mode");
    const vu = units.filter(u => isValidBounds(u.bounds));
    if (vu.length < MIN_DIST_LAYERS) throw new Error("This operation requires at least " + MIN_DIST_LAYERS + " objects");
    const items = vu.map(makeDistItem);
    const sorted = [...items].sort((a, b) => a[cfg.sortKey] - b[cfg.sortKey]);
    const fv = sorted[0][cfg.sortKey], lv = sorted[sorted.length - 1][cfg.sortKey];
    const step = (lv - fv) / (sorted.length - 1);
    const plan = [];
    for (let i = 0; i < sorted.length; i++) {
        const it = sorted[i];
        const tgt = fv + step * i;
        const d = tgt - it[cfg.sortKey];
        let dx = 0, dy = 0;
        if (cfg.axis === "x") dx = d; else dy = d;
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error("Cannot compute distribution position");
        plan.push({ unit: it.unit, dx, dy });
    }
    return plan;
}
function buildPreciseDistributionPlan(units, mode, spacing) {
    const cfg = PRECISE_DIST_CONFIG[mode];
    if (!cfg) throw new Error("Unknown distribution mode");
    if (!Number.isFinite(spacing)) throw new Error("Invalid spacing");
    const vu = units.filter(u => isValidBounds(u.bounds));
    if (vu.length < MIN_DIST_LAYERS) throw new Error("This operation requires at least " + MIN_DIST_LAYERS + " objects");
    const items = vu.map(makeDistItem);
    const sorted = [...items].sort((a, b) => a[cfg.sortKey] - b[cfg.sortKey]);
    const plan = [{ unit: sorted[0].unit, dx: 0, dy: 0 }];
    let cur = sorted[0][cfg.sortKey];
    for (let i = 1; i < sorted.length; i++) {
        const it = sorted[i];
        cur = cur + spacing;
        const d = cur - it[cfg.sortKey];
        if (!Number.isFinite(d)) throw new Error("Cannot compute distribution position");
        if (cfg.axis === "x") plan.push({ unit: it.unit, dx: d, dy: 0 });
        else plan.push({ unit: it.unit, dx: 0, dy: d });
    }
    return plan;
}
async function executeDistribution(mode) {
    const hn = DIST_MODE_HISTORY_NAMES[mode];
    if (!hn) { showToast(t("unknownDistMode"), "error"); return; }
    const doc = getActiveDocument();
    if (!doc) { showToast(t("noOpenDocument"), "warning"); return; }
    const layers = getSelectedLayers(doc);
    if (!layers.length) { showToast(t("noSelectedLayers"), "warning"); return; }
    const alignByGroup = isAlignByGroup();
    const nonAdj = layers.filter(l => !isAdjustmentLayer(l));
    if (!nonAdj.length) { showToast(t("onlyAdjustmentDist"), "warning"); return; }
    const units = collectOperationUnits(doc, nonAdj, alignByGroup);
    if (!units || !units.length) { showToast(t("cannotComputeBounds"), "warning"); return; }
    if (units.length < MIN_DIST_LAYERS) { showToast(tf("needLayers", MIN_DIST_LAYERS), "warning"); return; }
    const precise = isPreciseMode();
    const spacing = precise ? getSpacing() : 0;
    await executeAsSingleHistoryStep(hn, async () => {
        await runWithLinkAwareness(doc, units, [], async (fu) => {
            const plan = precise ? buildPreciseDistributionPlan(fu, mode, spacing) : buildDistributionPlan(fu, mode);
            for (const it of plan) {
                if (abortRequested) break;
                if (!needsMove(it.dx, it.dy)) continue;
                await prepareAndMoveUnit(it.unit, it.dx, it.dy);
            }
        });
    });
    showOperationResult(tf("opCompleted", DIST_MODE_LABELS[mode]));
}


/* ---------- 排列 ---------- */

function buildArrangePlanFromUnits(items, mode, spacing) {
    if (mode !== "h" && mode !== "v") throw new Error("Unknown arrangement mode");
    if (!items || items.length < MIN_ARRANGE_LAYERS) throw new Error("This operation requires at least " + MIN_ARRANGE_LAYERS + " objects to arrange");
    if (!Number.isFinite(spacing)) throw new Error("Invalid spacing");
    const sk = mode === "h" ? "left" : "top";
    const sorted = [...items].sort((a, b) => a.realBounds[sk] - b.realBounds[sk]);
    const plan = [{ unit: sorted[0].unit, dx: 0, dy: 0 }];
    let cur = mode === "h" ? sorted[0].realBounds.right : sorted[0].realBounds.bottom;
    for (let i = 1; i < sorted.length; i++) {
        const it = sorted[i];
        const tgt = cur + spacing;
        if (mode === "h") {
            const dx = tgt - it.realBounds.left;
            if (!Number.isFinite(dx)) throw new Error("Cannot compute arrangement position");
            plan.push({ unit: it.unit, dx, dy: 0 });
            cur = it.realBounds.right + dx;
        } else {
            const dy = tgt - it.realBounds.top;
            if (!Number.isFinite(dy)) throw new Error("Cannot compute arrangement position");
            plan.push({ unit: it.unit, dx: 0, dy });
            cur = it.realBounds.bottom + dy;
        }
    }
    return plan;
}
async function executeArrange(mode) {
    const hn = ARRANGE_MODE_HISTORY_NAMES[mode];
    if (!hn) { showToast(t("unknownArrangeMode"), "error"); return; }
    if (!isPreciseMode()) { showToast(t("enablePreciseArrangeFirst"), "warning"); return; }
    const doc = getActiveDocument();
    if (!doc) { showToast(t("noOpenDocument"), "warning"); return; }
    const layers = getSelectedLayers(doc);
    if (!layers.length) { showToast(t("noSelectedLayers"), "warning"); return; }
    const alignByGroup = isAlignByGroup();
    const spacing = getSpacing();
    const nonAdj = layers.filter(l => !isAdjustmentLayer(l));
    if (!nonAdj.length) { showToast(t("onlyAdjustmentArrange"), "warning"); return; }
    const pIdx = buildLayerIndex(doc);
    const pUnits = collectOperationUnits(doc, nonAdj, alignByGroup, pIdx);
    if (!pUnits || !pUnits.length) { showToast(t("cannotComputeBounds"), "warning"); return; }
    if (pUnits.length < MIN_ARRANGE_LAYERS) { showToast(tf("needObjects", MIN_ARRANGE_LAYERS), "warning"); return; }
    await executeAsSingleHistoryStep(hn, async () => {
        await runWithLinkAwareness(doc, pUnits, [], async (fu) => {
            const index = buildLayerIndex(doc);
            const items = [];
            for (const u of fu) {
                let rb = null;
                try { rb = await getUnitRealPixelBounds(doc, u, index); } catch (e) {}
                if (!rb) rb = u.bounds;
                if (!isValidBounds(rb)) continue;
                items.push({ unit: u, realBounds: rb });
            }
            if (items.length < MIN_ARRANGE_LAYERS) throw new Error("This operation requires at least " + MIN_ARRANGE_LAYERS + " objects");
            const plan = buildArrangePlanFromUnits(items, mode, spacing);
            for (const it of plan) {
                if (abortRequested) break;
                if (!needsMove(it.dx, it.dy)) continue;
                await prepareAndMoveUnit(it.unit, it.dx, it.dy);
            }
        });
    });
    showOperationResult(tf("opCompleted", ARRANGE_MODE_LABELS[mode]));
}


/* ---------- 顶部缩放 ---------- */

async function executeFit(mode) {
    const hn = FIT_MODE_HISTORY_NAMES[mode];
    if (!hn) { showToast(t("unknownFitMode"), "error"); return; }
    const doc = getActiveDocument();
    if (!doc) { showToast(t("noOpenDocument"), "warning"); return; }
    const cw = Number(doc.width), ch = Number(doc.height);
    if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw <= 0 || ch <= 0) { showToast(t("cannotGetCanvasSize"), "error"); return; }
    const layers = getSelectedLayers(doc);
    if (!layers.length) { showToast(t("noSelectedLayers"), "warning"); return; }
    const alignByGroup = isAlignByGroup();
    const nonAdj = layers.filter(l => !isAdjustmentLayer(l));
    if (!nonAdj.length) { showToast(t("onlyAdjustmentProcess"), "warning"); return; }
    const pIdx = buildLayerIndex(doc);
    const pUnits = collectOperationUnits(doc, nonAdj, alignByGroup, pIdx);
    if (!pUnits || !pUnits.length) { showToast(t("cannotComputeBounds"), "warning"); return; }
    for (const u of pUnits) {
        if (!isValidBounds(u.bounds) || isEmptyBounds(u.bounds)) { showToast(t("cannotComputeBounds"), "warning"); return; }
    }
    await executeAsSingleHistoryStep(hn, async () => {
        await runWithLinkAwareness(doc, pUnits, [], async (fu) => {
            const index = buildLayerIndex(doc);
            for (const u of fu) {
                if (abortRequested) break;
                await prepareAndFitUnit(doc, u, mode, cw, ch, index);
            }
        });
    });
    showOperationResult(tf("opCompleted", FIT_MODE_LABELS[mode]));
}


/* ---------- 自动对齐图层 ---------- */

async function autoAlignLayers() {
    const doc = getActiveDocument();
    if (!doc) { showToast(t("noOpenDocument"), "warning"); return; }
    const layers = getSelectedLayers(doc);
    if (layers.length < AUTO_ALIGN_MIN_LAYERS) {
        showToast(tf("autoAlignNeedLayers", AUTO_ALIGN_MIN_LAYERS), "warning");
        return;
    }
    const beforePos = new Map();
    for (const l of layers) {
        const id = Number(l.id);
        if (!Number.isFinite(id)) continue;
        if (isAdjustmentLayer(l)) continue;
        let b = null;
        try { b = getLayerBounds(l); } catch (e) {}
        if (isValidBounds(b)) beforePos.set(id, { left: b.left, top: b.top });
    }
    if (!beforePos.size) { showToast(t("cannotReadLayerPos"), "error"); return; }
    const descs = [{
        _obj: "align",
        _target: [{ _enum: "ordinal", _ref: "layer" }],
        alignToCanvas: false,
        apply: { _enum: "projection", _value: "auto" },
        radialDistort: false,
        using: { _enum: "alignDistributeSelector", _value: "ADSContent" },
        vignette: false,
        _options: { dialogOptions: "display" }
    }];
    const opts = { synchronousExecution: false, continueOnError: false, immediateRedraw: false, modalBehavior: "execute" };
    try {
        await core.executeAsModal(async () => { await batchPlay(descs, opts); }, { commandName: t("autoAlignLayers") });
    } catch (e) {
        if (isUserCancelError(e)) { showToast(t("userCancelled"), "warning"); return; }
        throw e;
    }
    const doc2 = getActiveDocument();
    if (!doc2) return;
    let anyMoved = false, compared = 0;
    for (const [id, before] of beforePos) {
        const l = findLayerByIdInDoc(doc2, id);
        if (!l) continue;
        let after = null;
        try { after = getLayerBounds(l); } catch (e) {}
        if (!isValidBounds(after)) continue;
        compared++;
        if (Math.abs(after.left - before.left) > AUTO_ALIGN_MOVE_THRESHOLD ||
            Math.abs(after.top - before.top) > AUTO_ALIGN_MOVE_THRESHOLD) anyMoved = true;
    }
    if (compared === 0) return;
    if (anyMoved) showToast(t("autoAlignDone"), "success");
    else showToast(t("autoAlignNoMove"), "warning");
}


/* ---------- 事件 ---------- */

function onRefButtonClick(event) {
    if (isBusy) return;
    const btn = event.currentTarget;
    const ref = btn && btn.dataset ? btn.dataset.ref : "";
    if (!ref) return;
    alignReference = ref;
    updateRefButtonsUI();
    updateUIState();
}
function onAlignClick(event) {
    if (isBusy) return;
    const mode = event.currentTarget.dataset.align;
    if (!ALIGN_MODE_HISTORY_NAMES[mode]) {
        showToast(tf("notImplementedAlign", (ALIGN_MODE_LABELS[mode] || mode)), "info");
        return;
    }
    runWithLock(ALIGN_MODE_LABELS[mode], () => executeAlignment(mode));
}
function onDistClick(event) {
    if (isBusy) return;
    const mode = event.currentTarget.dataset.dist;
    if (!DIST_MODE_HISTORY_NAMES[mode]) {
        showToast(tf("notImplementedDist", (DIST_MODE_LABELS[mode] || mode)), "info");
        return;
    }
    runWithLock(DIST_MODE_LABELS[mode], () => executeDistribution(mode));
}
function onArrangeHClick() { if (isBusy) return; runWithLock(ARRANGE_MODE_LABELS.h, () => executeArrange("h")); }
function onArrangeVClick() { if (isBusy) return; runWithLock(ARRANGE_MODE_LABELS.v, () => executeArrange("v")); }
function onFitCanvasClick() { if (isBusy) return; runWithLock(FIT_MODE_LABELS.fitCanvas, () => executeFit("fitCanvas")); }
function onFitHeightClick() { if (isBusy) return; runWithLock(FIT_MODE_LABELS.fitHeight, () => executeFit("fitHeight")); }
function onFitWidthClick() { if (isBusy) return; runWithLock(FIT_MODE_LABELS.fitWidth, () => executeFit("fitWidth")); }
function onAutoAlignClick() { if (isBusy) return; runWithLock(t("autoAlignLayers"), () => autoAlignLayers()); }
function onSpacingWheel(event) {
    event.preventDefault();
    if (isBusy) return;
    let step = 1;
    if (event.shiftKey) step = 10;
    if (event.deltaY > 0) step = -step;
    const cur = clampSpacingToInt(dom.spacingInput.value);
    dom.spacingInput.value = String(clampSpacingToInt(cur + step));
}
function onSpacingBlur() { dom.spacingInput.value = String(clampSpacingToInt(dom.spacingInput.value)); }
function onSpacingInput() {
    let v = String(dom.spacingInput.value || "");
    v = v.replace(/[^\d\-]/g, "");
    const neg = v.startsWith("-");
    v = v.replace(/-/g, "");
    if (neg) v = "-" + v;
    if (v.length > 8) v = v.slice(0, 8);
    if (v !== dom.spacingInput.value) dom.spacingInput.value = v;
}
function onSpacingMouseDown(event) {
    try { event.stopPropagation(); } catch (e) {}
    setTimeout(() => { try { dom.spacingInput.focus(); } catch (e) {} }, 0);
}
function onPreciseChange() { updateUIState(); }
function onIgnoreAdjustmentChange() { updateUIState(); }


/* ---------- 初始化 ---------- */

function diagnoseLinkedLayers() {
    try {
        const doc = app.activeDocument;
        if (!doc || !doc.layers || !doc.layers.length) return;
        const l = doc.layers[0];
        let hasProp = false, val = null;
        try { hasProp = (l.linkedLayers !== undefined); val = l.linkedLayers; } catch (e) {}
        console.log("[init][diagnose] 顶层图层[" + (l.name || "") + "] linkedLayers 存在? "
            + hasProp + ", 类型=" + typeof val);
    } catch (e) {}
}

function initialize() {
    if (initialized) return;
    initialized = true;

    /* v62：语言判定 + UI 应用（必须在绑定事件之前） */
    currentLang = detectLanguage();
    console.log("[i18n][detect] locale=" + (function(){ try { return String(app.locale || ""); } catch (e) { return ""; } })()
        + " currentLang=" + currentLang);
    localizeLabels();
    applyLanguageToUI();

    /* v63：延迟重试，确保 UXP 刷新 tooltip */
    setTimeout(() => {
        try { applyLanguageToUI(); } catch (e) {}
    }, 300);

    if (dom.btnAutoAlign) {
        dom.btnAutoAlign.setAttribute("title", t("tipAutoAlign"));
        dom.btnAutoAlign.setAttribute("aria-label", t("tipAutoAlign"));
    }
    initTheme();
    setupKeyObjectListener();
    setupEscListener();
    bindButton(dom.btnFitCanvas, onFitCanvasClick);
    bindButton(dom.btnAutoAlign, onAutoAlignClick);
    bindButton(dom.btnFitHeight, onFitHeightClick);
    bindButton(dom.btnFitWidth, onFitWidthClick);
    dom.refButtons.forEach(b => bindButton(b, onRefButtonClick));
    dom.alignButtons.forEach(b => bindButton(b, onAlignClick));
    dom.distButtons.forEach(b => bindButton(b, onDistClick));
    bindButton(dom.btnArrangeH, onArrangeHClick);
    bindButton(dom.btnArrangeV, onArrangeVClick);
    dom.spacingInput.addEventListener("input", onSpacingInput);
    dom.spacingInput.addEventListener("blur", onSpacingBlur);
    dom.spacingInput.addEventListener("wheel", onSpacingWheel, { passive: false });
    dom.spacingInput.addEventListener("mousedown", onSpacingMouseDown);
    dom.chkPrecise.addEventListener("change", onPreciseChange);
    dom.chkIgnoreLink.addEventListener("change", updateUIState);
    dom.chkIgnoreAdjustment.addEventListener("change", onIgnoreAdjustmentChange);
    dom.chkAlignByGroup.addEventListener("change", updateUIState);
    dom.spacingInput.value = "0";
    if (dom.toast) dom.toast.style.display = "none";
    updateRefButtonsUI();
    updateUIState();
    diagnoseLinkedLayers();
    console.log("[init] 初始化完成 (v63)");
}

initialize();