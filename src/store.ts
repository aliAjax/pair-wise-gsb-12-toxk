import { defineStore } from "pinia";
import { DRIVERS, LOAD_BAYS, MEDIA, TANK_VEHICLES } from "./data";
import { checkLoadingGround, evaluateGate } from "./rules";
import type {
  DispatchDraft,
  DispatchTask,
  GateRecord,
  LeakEvent,
  LoadVersion
} from "./types";

const STORAGE_KEY = "hazchem-dock-console-v1";

interface PersistShape {
  tasks: DispatchTask[];
  events: LeakEvent[];
}

function seed(): PersistShape {
  const now = Date.now();
  const iso = (offsetMin: number) => new Date(now + offsetMin * 60000).toISOString();
  const local = (offsetMin: number) => {
    const d = new Date(now + offsetMin * 60000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const leak: LeakEvent = {
    id: "seed-leak-1",
    code: "LK-20260922-01",
    bayId: "B3",
    mediumId: "M04",
    level: "一般",
    occurredAt: iso(-150),
    description: "3号鹤位装车软管接口滴漏，现场围堵中，待处置完成后关闭。",
    closedAt: null,
    closeNotes: ""
  };

  const abortedVersion: LoadVersion = {
    seq: 1,
    startedAt: iso(-165),
    startLoadedKg: 0,
    endLoadedKg: 6200,
    endedAt: iso(-150),
    reason: "泄漏事件 LK-20260922-01 联动紧急中止",
    byLeak: true
  };

  const task2: DispatchTask = {
    id: "seed-task-2",
    code: "PC-20260922-02",
    vehiclePlate: TANK_VEHICLES[2].plate,
    driverName: "周航",
    bayId: "B3",
    mediumId: "M04",
    plannedStart: local(-180),
    plannedEnd: local(-60),
    targetKg: 24000,
    loadedKg: 6200,
    status: "已中止",
    notes: "等待泄漏处置结束后复装",
    createdAt: iso(-200),
    resistanceOhm: 4.2,
    clampFeedback: true,
    operator: "值班员 林岚",
    gates: [
      {
        at: iso(-190),
        operator: "值班员 林岚",
        resistanceOhm: 4.2,
        clampFeedback: true,
        licenseValid: true,
        passed: true,
        reasons: []
      }
    ],
    versions: [abortedVersion],
    leakEventId: leak.id
  };

  const task1: DispatchTask = {
    id: "seed-task-1",
    code: "PC-20260922-01",
    vehiclePlate: TANK_VEHICLES[0].plate,
    driverName: "董飞",
    bayId: "B1",
    mediumId: "M01",
    plannedStart: local(30),
    plannedEnd: local(150),
    targetKg: 28000,
    loadedKg: 0,
    status: "已放行",
    notes: "按计划到车",
    createdAt: iso(-30),
    resistanceOhm: 6.5,
    clampFeedback: true,
    operator: "值班员 林岚",
    gates: [
      {
        at: iso(-25),
        operator: "值班员 林岚",
        resistanceOhm: 6.5,
        clampFeedback: true,
        licenseValid: true,
        passed: true,
        reasons: []
      }
    ],
    versions: [],
    leakEventId: null
  };

  return { tasks: [task2, task1], events: [leak] };
}

function load(): PersistShape {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seed();
  try {
    const parsed = JSON.parse(raw) as PersistShape;
    if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.events)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function dayStamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export interface GateSubmitOutcome {
  ok: boolean;
  reasons: string[];
  taskId: string;
}

export const useConsoleStore = defineStore("console", {
  state: () => {
    const initial = load();
    return {
      tasks: initial.tasks as DispatchTask[],
      events: initial.events as LeakEvent[],
      media: MEDIA,
      vehicles: TANK_VEHICLES,
      drivers: DRIVERS,
      bays: LOAD_BAYS
    };
  },

  getters: {
    openLeakEvents: (state) => state.events.filter((e) => e.closedAt === null),

    bayBlocked(state) {
      return (bayId: string) => state.events.find((e) => e.bayId === bayId && e.closedAt === null) ?? null;
    },

    metrics: (state) => {
      const loading = state.tasks.filter((t) => t.status === "装车中").length;
      const released = state.tasks.filter((t) => t.status === "已放行" || t.status === "待放行").length;
      const aborted = state.tasks.filter((t) => t.status === "已中止").length;
      const openLeaks = state.events.filter((e) => e.closedAt === null).length;
      return {
        total: state.tasks.length,
        loading,
        pending: released,
        aborted,
        openLeaks
      };
    }
  },

  actions: {
    persist() {
      const data: PersistShape = { tasks: this.tasks, events: this.events };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    nextCode(prefix: "PC" | "LK") {
      const stamp = dayStamp();
      const todayCount =
        prefix === "PC"
          ? this.tasks.filter((t) => t.code.includes(stamp)).length
          : this.events.filter((e) => e.code.includes(stamp)).length;
      return `${prefix}-${stamp}-${String(todayCount + 1).padStart(2, "0")}`;
    },

    /** 派车单登记/重新校验：不通过则整单停留"待放行"，输入由页面保留 */
    submitGate(draft: DispatchDraft, editingId?: string): GateSubmitOutcome {
      const others = editingId ? this.tasks.filter((t) => t.id !== editingId) : this.tasks;
      const result = evaluateGate(draft, others, this.events);
      const record: GateRecord = {
        at: new Date().toISOString(),
        operator: draft.operator || "未填报值班员",
        resistanceOhm: Number(draft.resistanceOhm),
        clampFeedback: draft.clampFeedback,
        licenseValid: result.licenseValid,
        passed: result.passed,
        reasons: result.reasons
      };

      let task = editingId ? this.tasks.find((t) => t.id === editingId) : undefined;
      if (task) {
        // 只有尚未开始装车的单允许重新校验放行
        if (task.status !== "待放行" && task.status !== "已放行") {
          return { ok: false, reasons: ["当前状态不允许重新校验"], taskId: task.id };
        }
        task.vehiclePlate = draft.vehiclePlate;
        task.driverName = draft.driverName;
        task.bayId = draft.bayId;
        task.mediumId = draft.mediumId;
        task.plannedStart = draft.plannedStart;
        task.plannedEnd = draft.plannedEnd;
        task.targetKg = Number(draft.targetKg);
        task.notes = draft.notes;
        task.resistanceOhm = Number(draft.resistanceOhm);
        task.clampFeedback = draft.clampFeedback;
        task.operator = record.operator;
        task.gates.push(record);
        task.status = result.passed ? "已放行" : "待放行";
      } else {
        task = {
          id: crypto.randomUUID(),
          code: this.nextCode("PC"),
          vehiclePlate: draft.vehiclePlate,
          driverName: draft.driverName,
          bayId: draft.bayId,
          mediumId: draft.mediumId,
          plannedStart: draft.plannedStart,
          plannedEnd: draft.plannedEnd,
          targetKg: Number(draft.targetKg),
          loadedKg: 0,
          status: result.passed ? "已放行" : "待放行",
          notes: draft.notes,
          createdAt: new Date().toISOString(),
          resistanceOhm: Number(draft.resistanceOhm),
          clampFeedback: draft.clampFeedback,
          operator: record.operator,
          gates: [record],
          versions: [],
          leakEventId: null
        };
        this.tasks.unshift(task);
      }

      this.persist();
      return { ok: result.passed, reasons: result.reasons, taskId: task.id };
    },

    /** 已放行 → 装车中，建立第 1 个装车版本 */
    startLoading(taskId: string) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task || task.status !== "已放行") return;
      this.openVersion(task);
    },

    /** 已中止 → 装车中，复装生成新版本 */
    resumeLoading(taskId: string) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task || task.status !== "已中止") return;
      if (this.bayBlocked(task.bayId)) return;
      this.openVersion(task);
    },

    openVersion(task: DispatchTask) {
      const version: LoadVersion = {
        seq: task.versions.length + 1,
        startedAt: new Date().toISOString(),
        startLoadedKg: task.loadedKg,
        endLoadedKg: null,
        endedAt: null,
        reason: null,
        byLeak: false
      };
      task.versions.push(version);
      task.status = "装车中";
      this.persist();
    },

    activeVersion(task: DispatchTask): LoadVersion | undefined {
      return task.versions.find((v) => v.endedAt === null);
    },

    /** 装车过程中更新已装量；接地异常时调用方应改调 abortLoading */
    updateLoaded(
      taskId: string,
      loadedKg: number,
      resistanceOhm: number,
      clampFeedback: boolean
    ): { ok: boolean; reasons: string[]; aborted?: boolean } {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task || task.status !== "装车中") return { ok: false, reasons: ["任务不在装车中"] };
      if (!Number.isFinite(loadedKg) || loadedKg < task.loadedKg) {
        return { ok: false, reasons: ["已装量不能小于上次记录值"] };
      }
      if (loadedKg > task.targetKg) {
        return { ok: false, reasons: ["已装量超过计划装车量"] };
      }
      const ground = checkLoadingGround(resistanceOhm, clampFeedback);
      if (!ground.ok) {
        // 接地断开：立即中止而不是仅拒绝更新
        this.abortLoading(taskId, loadedKg, resistanceOhm, clampFeedback, ground.reason!, false);
        return { ok: false, aborted: true, reasons: [ground.reason!] };
      }
      task.loadedKg = loadedKg;
      this.persist();
      return { ok: true, reasons: [] };
    },

    /** 接地断开/人工急停：立即中止，封存当前版本的已装量与原因 */
    abortLoading(
      taskId: string,
      loadedKg: number,
      resistanceOhm: number,
      clampFeedback: boolean,
      reason: string,
      byLeak: boolean
    ) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task || task.status !== "装车中") return;
      const version = this.activeVersion(task);
      const safeKg = Number.isFinite(loadedKg) ? Math.max(0, loadedKg) : task.loadedKg;
      task.loadedKg = Math.min(safeKg, task.targetKg);
      task.resistanceOhm = resistanceOhm;
      task.clampFeedback = clampFeedback;
      if (version) {
        version.endLoadedKg = task.loadedKg;
        version.endedAt = new Date().toISOString();
        version.reason = reason;
        version.byLeak = byLeak;
      }
      task.status = "已中止";
      this.persist();
    },

    /** 接地正常、达到计划量：正常完成 */
    completeLoading(
      taskId: string,
      loadedKg: number,
      resistanceOhm: number,
      clampFeedback: boolean
    ): { ok: boolean; reasons: string[] } {
      const task = this.tasks.find((t) => t.id === taskId);
      if (!task || task.status !== "装车中") return { ok: false, reasons: ["任务不在装车中"] };
      if (!Number.isFinite(loadedKg) || loadedKg < task.loadedKg) {
        return { ok: false, reasons: ["已装量不能小于上次记录值"] };
      }
      const ground = checkLoadingGround(resistanceOhm, clampFeedback);
      if (!ground.ok) {
        this.abortLoading(taskId, loadedKg, resistanceOhm, clampFeedback, ground.reason!, false);
        return { ok: false, reasons: [`无法完成：${ground.reason}，已按中止处理`] };
      }
      const version = this.activeVersion(task);
      task.loadedKg = loadedKg;
      task.resistanceOhm = resistanceOhm;
      task.clampFeedback = clampFeedback;
      if (version) {
        version.endLoadedKg = loadedKg;
        version.endedAt = new Date().toISOString();
        version.reason = "装车完成";
        version.byLeak = false;
      }
      task.status = "已完成";
      this.persist();
      return { ok: true, reasons: [] };
    },

    /** 登记泄漏事件；若同装卸位正在装车，联动立即中止 */
    reportLeak(input: {
      bayId: string;
      mediumId: string;
      level: LeakEvent["level"];
      description: string;
    }): LeakEvent {
      const event: LeakEvent = {
        id: crypto.randomUUID(),
        code: this.nextCode("LK"),
        bayId: input.bayId,
        mediumId: input.mediumId,
        level: input.level,
        occurredAt: new Date().toISOString(),
        description: input.description,
        closedAt: null,
        closeNotes: ""
      };
      this.events.unshift(event);

      // 同装卸位装车中的任务立即中止
      for (const task of this.tasks) {
        if (task.bayId === input.bayId && task.status === "装车中") {
          task.leakEventId = event.id;
          this.abortLoading(
            task.id,
            task.loadedKg,
            Number(task.resistanceOhm ?? 0),
            Boolean(task.clampFeedback),
            `泄漏事件 ${event.code} 联动紧急中止`,
            true
          );
        }
      }
      this.persist();
      return event;
    },

    /** 关闭泄漏事件后，同装卸位方可接新任务/复装 */
    closeLeak(eventId: string, notes: string) {
      const event = this.events.find((e) => e.id === eventId);
      if (!event || event.closedAt) return;
      event.closedAt = new Date().toISOString();
      event.closeNotes = notes || "处置完成，检测合格。";
      this.persist();
    },

    removeTask(taskId: string) {
      this.tasks = this.tasks.filter((t) => t.id !== taskId);
      this.persist();
    }
  }
});
