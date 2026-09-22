// 临时逻辑验证脚本（不参与构建）
import { setActivePinia, createPinia } from "pinia";
import { useConsoleStore } from "../src/store";
import { evaluateGate, bayTimeConflict, isLicenseValid } from "../src/rules";
import type { DispatchDraft } from "../src/types";

// localStorage 桩
const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => {
    mem[k] = v;
  },
  removeItem: (k: string) => delete mem[k]
};

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error("✕", msg);
  }
}

setActivePinia(createPinia());
const store = useConsoleStore();
// 用空状态跑确定性测试
store.tasks = [];
store.events = [];

const now = new Date("2026-09-22T10:00:00");
assert(isLicenseValid("2026-09-22", now) === true, "到期当日有效");
assert(isLicenseValid("2026-09-21", now) === false, "过期一天无效");

function draft(over: Partial<DispatchDraft> = {}): DispatchDraft {
  return {
    vehiclePlate: "沪D·G8216 挂",
    driverName: "董飞",
    bayId: "B1",
    mediumId: "M01",
    plannedStart: "2026-09-22T14:00",
    plannedEnd: "2026-09-22T16:00",
    targetKg: 20000,
    notes: "",
    operator: "测试员",
    resistanceOhm: 5,
    clampFeedback: true,
    ...over
  };
}

// 1. 三类不放行
assert(evaluateGate(draft(), store.tasks, store.events, now).passed, "正常单应通过");
assert(!evaluateGate(draft({ resistanceOhm: 10.1 }), store.tasks, store.events, now).passed, "电阻10.1不放行");
assert(evaluateGate(draft({ resistanceOhm: 10 }), store.tasks, store.events, now).passed, "电阻恰好10放行");
assert(!evaluateGate(draft({ clampFeedback: false }), store.tasks, store.events, now).passed, "接地夹未回讯不放行");
const expired = evaluateGate(draft({ driverName: "孙立军" }), store.tasks, store.events, now);
assert(!expired.passed && expired.reasons.some((r) => r.includes("过期")), "危化证过期不放行");

// 介质资质
assert(!evaluateGate(draft({ mediumId: "M05" }), store.tasks, store.events, now).passed, "罐车无液氨资质");
assert(!evaluateGate(draft({ bayId: "B2" }), store.tasks, store.events, now).passed, "汽油不可在甲醇鹤位");

// 2. 不放行建单保留，整改后同一单放行
const bad = store.submitGate(draft({ resistanceOhm: 12 }));
assert(!bad.ok, "首次校验不通过");
const badTask = store.tasks.find((t) => t.id === bad.taskId)!;
assert(badTask.status === "待放行", "不通过停留待放行");
assert(badTask.gates.length === 1 && !badTask.gates[0].passed, "失败检查留痕");
const fix = store.submitGate(draft({ resistanceOhm: 4 }), bad.taskId);
assert(fix.ok, "整改后通过");
const fixedTask = store.tasks.find((t) => t.id === bad.taskId)!;
assert(fixedTask.status === "已放行" && store.tasks.length === 1 && fixedTask.gates.length === 2, "同一单二次检查留痕");

// 3. 装车/中止/复装版本
store.startLoading(fixedTask.id);
assert(fixedTask.status === "装车中" && fixedTask.versions.length === 1, "开始装车生成v1");
const upd = store.updateLoaded(fixedTask.id, 8000, 4, true);
assert(upd.ok && fixedTask.loadedKg === 8000, "已装量记录8000");
const updBad = store.updateLoaded(fixedTask.id, 9000, 11, true);
assert(!updBad.ok && updBad.aborted, "电阻超限触发自动中止");
assert(fixedTask.status === "已中止" && fixedTask.loadedKg === 9000, "中止时已装量封存9000");
const v1 = fixedTask.versions[0];
assert(v1.endLoadedKg === 9000 && v1.endedAt !== null && /11Ω/.test(v1.reason ?? ""), "v1封存数量与原因");

// 接地夹脱离中止
store.resumeLoading(fixedTask.id);
assert(fixedTask.status === "装车中" && fixedTask.versions.length === 2, "复装生成v2");
store.updateLoaded(fixedTask.id, 12000, 3, false);
assert(fixedTask.status === "已中止" && fixedTask.versions[1].reason?.includes("接地夹"), "接地夹脱离中止");
assert(fixedTask.versions[1].startLoadedKg === 9000, "v2起算9000");

// 4. 泄漏联动
store.resumeLoading(fixedTask.id);
const ev = store.reportLeak({ bayId: "B1", mediumId: "M01", level: "一般", description: "接口渗漏" });
assert(fixedTask.status === "已中止", "泄漏联动中止同位装车");
assert(fixedTask.leakEventId === ev.id && fixedTask.versions[2].byLeak, "版本标记泄漏联动");

// 未关闭：新单不可放行，复装被阻止
const blocked = store.submitGate(draft({ plannedStart: "2026-09-22T18:00", plannedEnd: "2026-09-22T20:00" }));
assert(!blocked.ok && blocked.reasons.some((r) => r.includes("LK-")), "泄漏未关闭同装卸位不得接新任务");
store.resumeLoading(fixedTask.id);
assert(fixedTask.status === "已中止", "封锁期间不能复装");

// 关闭后可放行可复装
store.closeLeak(ev.id, "处置完成");
const reopened = store.submitGate(
  draft({ plannedStart: "2026-09-22T18:00", plannedEnd: "2026-09-22T20:00" }),
  blocked.taskId
);
assert(reopened.ok, "泄漏关闭后新单可放行");
store.resumeLoading(fixedTask.id);
assert(fixedTask.status === "装车中" && fixedTask.versions.length === 4, "关闭后复装v4");

// 5. 完成装车
const done = store.completeLoading(fixedTask.id, 20000, 3, true);
assert(done.ok && fixedTask.status === "已完成" && fixedTask.loadedKg === 20000, "正常完成20000");
assert(fixedTask.versions[3].reason === "装车完成", "完成版本原因");

// 6. 时段冲突
const conflict = bayTimeConflict(
  "B1",
  "2026-09-22T19:00",
  "2026-09-22T19:30",
  store.tasks
);
assert(conflict?.code === blocked.taskId ? false : true, "已完成单不参与冲突，未完成单参与");
const overlap = bayTimeConflict(
  "B1",
  "2026-09-22T18:30",
  "2026-09-22T19:00",
  store.tasks.filter((t) => t.status !== "已完成")
);
assert(overlap !== null, "时段重叠判定冲突");

// 7. 持久化数据一致性
const raw = JSON.parse(mem["hazchem-dock-console-v1"]);
assert(Array.isArray(raw.tasks) && Array.isArray(raw.events), "持久化结构完整");
const persisted = raw.tasks.find((t: any) => t.id === fixedTask.id);
assert(persisted.versions.length === 4 && persisted.gates.length === 2, "刷新后版本与接地记录一致");

console.log(`\n${fail === 0 ? "全部通过" : "存在失败"}：${pass} 通过, ${fail} 失败`);
if (fail) process.exit(1);
