module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/apps/web/app/recovery/queue/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RecoveryQueuePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.3.4_@types+node@22.19.19_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/api.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$demo$2d$merchant$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/demo-merchant.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/lib/format.ts [app-rsc] (ecmascript)");
;
;
;
;
const STATE_LABEL = {
    RESERVED: "Awaiting approval",
    DISPATCHED: "Sent",
    FAILED: "Blocked / failed"
};
function stateColor(state, shieldVerdict) {
    if (shieldVerdict === "BLOCK" || state === "FAILED") return "text-at-risk";
    if (state === "DISPATCHED") return "text-recovered";
    return "text-muted";
}
async function RecoveryQueuePage() {
    const merchantId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$demo$2d$merchant$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireDemoMerchantId"])();
    const [actions, leaks] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRecoveryActions"])(merchantId),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$api$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getLeaks"])(merchantId)
    ]);
    const leakById = new Map(leaks.map((leak)=>[
            leak.id,
            leak
        ]));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-6 py-10 sm:px-10",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "text-[15px] font-medium",
                children: "Recovery queue"
            }, void 0, false, {
                fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                lineNumber: 24,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 max-w-[60ch] text-[13px] text-muted",
                children: "One row per proposed action — including the ones Shield blocked. Blocked actions stay visible with their reason; hiding them would defeat the point."
            }, void 0, false, {
                fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-8 border-t border-rule",
                children: [
                    actions.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "border-b border-rule py-6 text-[13px] text-muted",
                        children: "No recovery actions yet for this merchant."
                    }, void 0, false, {
                        fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                        lineNumber: 32,
                        columnNumber: 11
                    }, this),
                    actions.map((action)=>{
                        const leak = leakById.get(action.leakId);
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-b border-rule py-5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "flex items-baseline gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[14px] font-medium",
                                                    children: leak ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["leakClassLabel"])(leak.class) : action.leakId
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                                    lineNumber: 42,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-mono-figures text-[12px] text-muted",
                                                    children: action.actionClass
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                                    lineNumber: 45,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                            lineNumber: 41,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: `text-[13px] font-medium ${stateColor(action.state, action.shieldVerdict)}`,
                                            children: STATE_LABEL[action.state] ?? action.state
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                            lineNumber: 47,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                    lineNumber: 40,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-muted",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono-figures",
                                            children: [
                                                "checkout: ",
                                                action.checkoutId
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                            lineNumber: 52,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono-figures tabular-nums",
                                            children: [
                                                "EV ",
                                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$lib$2f$format$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPaise"])(action.evPaise)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                            lineNumber: 55,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                "Shield: ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-mono-figures",
                                                    children: action.shieldVerdict
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                                    lineNumber: 57,
                                                    columnNumber: 27
                                                }, this),
                                                action.shieldReason ? ` — ${action.shieldReason}` : ""
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                            lineNumber: 56,
                                            columnNumber: 17
                                        }, this),
                                        action.rzpRef && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono-figures",
                                            children: [
                                                "ref: ",
                                                action.rzpRef
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                            lineNumber: 60,
                                            columnNumber: 35
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                    lineNumber: 51,
                                    columnNumber: 15
                                }, this),
                                leak && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$3$2e$4_$40$types$2b$node$40$22$2e$19$2e$19_react$2d$dom$40$19$2e$2$2e$8_react$40$19$2e$2$2e$8_$5f$react$40$19$2e$2$2e$8$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "font-mono-figures mt-1 text-[12px] text-muted",
                                    children: [
                                        "evidence: ",
                                        leak.evidenceEventIds.join(", ")
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                                    lineNumber: 63,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, action.id, true, {
                            fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                            lineNumber: 39,
                            columnNumber: 13
                        }, this);
                    })
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/app/recovery/queue/page.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
}),
"[project]/apps/web/app/recovery/queue/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/apps/web/app/recovery/queue/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/apps/web/lib/api.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getLeaks",
    ()=>getLeaks,
    "getLedgerEntries",
    ()=>getLedgerEntries,
    "getRecoveryActions",
    ()=>getRecoveryActions,
    "verifyLedger",
    ()=>verifyLedger
]);
const API_BASE_URL = process.env.SEAM_API_URL ?? "http://localhost:8090";
// Server-side fetches only (Server Components) — this never runs in the
// browser, so there's no CORS surface to think about, and no API base URL
// gets shipped to the client bundle.
async function apiFetch(path) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        cache: "no-store"
    });
    if (!res.ok) {
        throw new Error(`${path} failed: ${res.status}`);
    }
    return res.json();
}
function getLeaks(merchantId) {
    return apiFetch(`/merchants/${merchantId}/leaks`);
}
function getRecoveryActions(merchantId) {
    return apiFetch(`/merchants/${merchantId}/recovery-actions`);
}
function getLedgerEntries(merchantId) {
    return apiFetch(`/ledger${merchantId ? `?merchantId=${merchantId}` : ""}`);
}
async function verifyLedger() {
    // Unlike every other endpoint here, a non-2xx (409) is a legitimate,
    // meaningful answer for this one — "the chain is broken, here's where" —
    // not a fetch failure. apiFetch's throw-on-!ok would swallow that.
    const res = await fetch(`${API_BASE_URL}/ledger/verify`, {
        cache: "no-store"
    });
    return res.json();
}
}),
"[project]/apps/web/lib/demo-merchant.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * There's no login/session auth in this build — deliberately deferred (see
 * PRD §16 open questions). Every screen renders one hardcoded merchant.
 * Swapping this for a real session-derived merchant id later touches this
 * one function, not every page.
 */ __turbopack_context__.s([
    "requireDemoMerchantId",
    ()=>requireDemoMerchantId
]);
function requireDemoMerchantId() {
    const id = process.env.SEAM_DEMO_MERCHANT_ID;
    if (!id) throw new Error("SEAM_DEMO_MERCHANT_ID is not set");
    return id;
}
}),
"[project]/apps/web/lib/format.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "formatPaise",
    ()=>formatPaise,
    "leakClassLabel",
    ()=>leakClassLabel
]);
const rupeeFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
});
function formatPaise(paise) {
    const rupees = Number(paise) / 100;
    return rupeeFormatter.format(rupees);
}
const LEAK_CLASS_LABELS = {
    PAYMENT_BLOCKED: "Payment blocked",
    ISSUER_DOWNTIME: "Issuer downtime",
    SILENT_ABANDON: "Silent abandon",
    PRE_CHECKOUT_DROP: "Pre-checkout drop",
    METHOD_CONCENTRATION: "Method concentration",
    POST_PURCHASE_LEAK: "Post-purchase leak"
};
function leakClassLabel(leakClass) {
    return LEAK_CLASS_LABELS[leakClass] ?? leakClass;
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0_vph9c._.js.map