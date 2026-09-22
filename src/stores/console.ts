// 联动台状态层：派车单、接地读数、泄漏事件、装车版本统一存放，
// 每次变更立即写入 localStorage，刷新后任务 / 接地 / 事件 / 版本一致。
import { defineStore } from "pinia";
import type {
  AbortRecord,
  ActionResult,
  DispatchDraft,
  LeakEvent,
  Task,
  TaskStatus
} from "../types";
import { createSeedLeakEvents, createSeedTasks, SEED_SEQUENCE } from "../data/seed";
import {
  evaluateDispatchGate,
  groundingFailureReasons,
  isGroundingSafe
} from "../rules/safety";

const STORAGE_KEY = "dfwlfront-3-hazmat-console-v1";

/** 装车模拟：每 500ms 装入的吨数 */
const LOAD_TICK_MS = 500;
const LOAD_STEP = 0.25;

interface PersistState {
  tasks: Task[];
  leakEvents: LeakEvent[];
  sequence: number;
}

interface ConsoleState extends PersistState {
  /** 派车登记草稿：放行失败时整单保留输入 */
  draft: DispatchDraft | null;
}

function loadPersisted(): PersistState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistState;
      if (Array.isArray(parsed.tasks) && Array.isArray(parsed.leakEvents)) {
        return { tasks: parsed.tasks, leakEvents: parsed.leakEvents, sequence: parsed.sequence ?? 0 };
      }
    } catch {
      // 数据损坏时回落到演示数据
    }
  }
  return {
    tasks: createSeedTasks(),
    leakEvents: createSeedLeakEvents(),
    sequence: SEED_SEQUENCE
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 仅对正在装车的任务运行模拟装量计时器 */
const loadingTimers = new Map<string, ReturnType<typeof setInterval>>();

export const useConsoleStore = defineStore("hazmat-console", {
  state: (): ConsoleState => {
    const persisted = loadPersisted();
    return { ...persisted, draft: null };
  },

  getters: {
    /** 指定装卸位是否因未关闭泄漏事件被锁定 */
    bayLocked: (state) => (bayId: string) =>
      state.leakEvents.some((event) => event.bayId === bayId && event.status === "处理中"),

    openLeakCount: (state) => state.leakEvents.filter((event) => event.status === "处理中").length
  },

  actions: {
    persist() {
      const data: PersistState = {
        tasks: this.tasks,
        leakEvents: this.leakEvents,
        sequence: this.sequence
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    findTask(id: string): Task | undefined {
      return this.tasks.find((task) => task.id === id);
    },

    nextOrderNo(): string {
      this.sequence += 1;
      return `PC-${String(this.sequence).padStart(4, "0")}`;
    },

    /** 登记派车单：闸门不通过则整单不放行并保留输入 */
    registerDispatch(draft: DispatchDraft): ActionResult {
      this.draft = JSON.parse(JSON.stringify(draft)) as DispatchDraft;
      const gate = evaluateDispatchGate(draft, this.leakEvents);
      if (!gate.allowed) {
        return { ok: false, reasons: gate.reasons };
      }

      const orderNo = this.nextOrderNo();
      const task: Task = {
        id: crypto.randomUUID(),
        orderNo,
        vehicleId: draft.vehicleId,
        driverId: draft.driverId,
        bayId: draft.bayId,
        medium: draft.medium,
        plannedQuantity: draft.plannedQuantity ?? 0,
        loadedQuantity: 0,
        windowStart: draft.windowStart,
        windowEnd: draft.windowEnd,
        status: "待装车",
        version: 1,
        grounding: {
          resistance: draft.resistance ?? 0,
          clampConnected: draft.clampConnected,
          updatedAt: nowIso()
        },
        aborts: [],
        notes: draft.notes || "暂无备注",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      this.tasks.unshift(task);
      this.draft = null;
      this.persist();
      return { ok: true, reasons: [], orderNo };
    },

    /** 待装车 -> 装车中（首装开始） */
    startLoading(taskId: string): ActionResult {
      const task = this.findTask(taskId);
      if (!task || task.status !== "待装车") return { ok: false, reasons: ["当前状态不可开始装车"] };
      return this.enterLoading(task);
    },

    /** 已中止 -> 装车中（复装：生成新版本） */
    resumeLoading(taskId: string): ActionResult {
      const task = this.findTask(taskId);
      if (!task || task.status !== "已中止") return { ok: false, reasons: ["仅已中止的任务可以复装"] };
      const failReasons = groundingFailureReasons(task.grounding);
      if (failReasons.length > 0) {
        return { ok: false, reasons: [`复装被拦截：${failReasons.join("、")}`] };
      }
      task.version += 1;
      task.status = "装车中";
      task.updatedAt = nowIso();
      this.persist();
      this.ensureTimer(task);
      return { ok: true, reasons: [], orderNo: task.orderNo };
    },

    /** 装车中 -> 已中止，冻结当前版本、已装量与原因 */
    abortLoading(taskId: string, reason: string) {
      const task = this.findTask(taskId);
      if (!task || task.status !== "装车中") return;
      const record: AbortRecord = {
        version: task.version,
        loadedQuantity: Number(task.loadedQuantity.toFixed(2)),
        reason,
        at: nowIso()
      };
      task.aborts.push(record);
      task.status = "已中止" satisfies TaskStatus;
      task.loadedQuantity = record.loadedQuantity;
      task.updatedAt = record.at;
      this.clearTimer(taskId);
      this.persist();
    },

    /** 实时更新接地读数；装车中任一异常立即中止装车 */
    updateGrounding(taskId: string, resistance: number, clampConnected: boolean): ActionResult {
      const task = this.findTask(taskId);
      if (!task) return { ok: false, reasons: ["任务不存在"] };
      task.grounding = { resistance, clampConnected, updatedAt: nowIso() };
      task.updatedAt = nowIso();

      if (task.status === "装车中" && !isGroundingSafe(task.grounding)) {
        const reasons = groundingFailureReasons(task.grounding);
        this.abortLoading(taskId, `装车中接地异常，立即中止：${reasons.join("；")}`);
        return { ok: false, reasons: ["已立即中止装车", ...reasons] };
      }

      this.persist();
      return { ok: true, reasons: [] };
    },

    /** 刷新后恢复装车模拟（不改变版本） */
    continueLoading(taskId: string): ActionResult {
      const task = this.findTask(taskId);
      if (!task || task.status !== "装车中") return { ok: false, reasons: ["仅装车中任务可继续"] };
      return this.enterLoading(task, true);
    },

    /** 内部：进入/保持装车状态并启动计时器 */
    enterLoading(task: Task, isContinue = false): ActionResult {
      const failReasons = groundingFailureReasons(task.grounding);
      if (failReasons.length > 0) {
        return { ok: false, reasons: [`禁止装车：${failReasons.join("、")}`] };
      }
      if (!isContinue) task.status = "装车中";
      task.updatedAt = nowIso();
      this.persist();
      this.ensureTimer(task);
      return { ok: true, reasons: [] };
    },

    ensureTimer(task: Task) {
      if (loadingTimers.has(task.id)) return;
      const timer = setInterval(() => this.loadingTick(task.id), LOAD_TICK_MS);
      loadingTimers.set(task.id, timer);
    },

    clearTimer(taskId: string) {
      const timer = loadingTimers.get(taskId);
      if (timer) {
        clearInterval(timer);
        loadingTimers.delete(taskId);
      }
    },

    /** 装车模拟推进：达到计划量自动完成 */
    loadingTick(taskId: string) {
      const task = this.findTask(taskId);
      if (!task || task.status !== "装车中") {
        this.clearTimer(taskId);
        return;
      }
      task.loadedQuantity = Math.min(task.plannedQuantity, Number((task.loadedQuantity + LOAD_STEP).toFixed(2)));
      if (task.loadedQuantity >= task.plannedQuantity) {
        task.status = "已完成" satisfies TaskStatus;
        task.notes = task.notes || "装车完成";
        task.updatedAt = nowIso();
        this.clearTimer(taskId);
      }
      this.persist();
    },

    isLive(taskId: string): boolean {
      return loadingTimers.has(taskId);
    },

    /** 上报泄漏事件：同一装卸位已有处理中事件时不重复立案 */
    reportLeak(event: Omit<LeakEvent, "id" | "reportedAt" | "status">): ActionResult {
      if (this.bayLocked(event.bayId)) {
        return { ok: false, reasons: ["该装卸位已有处理中的泄漏事件，关闭前不得重复登记"] };
      }
      this.leakEvents.unshift({
        ...event,
        id: crypto.randomUUID(),
        reportedAt: nowIso(),
        status: "处理中"
      });
      // 泄漏联动：立即中止该装卸位正在进行的装车（原因为安全联锁）
      this.tasks
        .filter((task) => task.bayId === event.bayId && task.status === "装车中")
        .forEach((task) =>
          this.abortLoading(task.id, `装卸位发生${event.level}事件，安全联锁立即中止装车（${event.medium}）`)
        );
      this.persist();
      return { ok: true, reasons: [] };
    },

    /** 关闭泄漏事件；关闭前同装卸位不得接新任务 */
    closeLeak(eventId: string, closeNotes: string): ActionResult {
      const event = this.leakEvents.find((item) => item.id === eventId);
      if (!event) return { ok: false, reasons: ["事件不存在"] };
      if (event.status === "已关闭") return { ok: false, reasons: ["事件已关闭"] };
      event.status = "已关闭";
      event.closedAt = nowIso();
      event.closeNotes = closeNotes || "现场处置完成，检测合格后恢复使用";
      this.persist();
      return { ok: true, reasons: [] };
    },

    /** 恢复演示数据 */
    resetDemo() {
      this.tasks.forEach((task) => this.clearTimer(task.id));
      this.tasks = createSeedTasks();
      this.leakEvents = createSeedLeakEvents();
      this.sequence = SEED_SEQUENCE;
      this.draft = null;
      this.persist();
    }
  }
});
