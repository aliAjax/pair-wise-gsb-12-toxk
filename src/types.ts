// 危化品装卸联动台领域模型

/** 任务状态：草稿/待放行 → 已放行 → 装车中 → 已中止（可复装）→ 已完成 */
export type TaskStatus =
  | "待放行"
  | "已放行"
  | "装车中"
  | "已中止"
  | "已完成";

export interface TankVehicle {
  plate: string;
  /** 允许承运的介质编号 */
  allowedMedia: string[];
  /** 额定载重 kg */
  capacityKg: number;
  /** 罐体最近检验日期 */
  inspectedAt: string;
}

export interface Driver {
  name: string;
  /** 危化品运输从业资格证号 */
  licenseNo: string;
  /** 危化证到期日 yyyy-mm-dd */
  licenseExpire: string;
}

export interface LoadBay {
  id: string;
  name: string;
  /** 该装卸位允许作业的介质编号 */
  allowedMedia: string[];
}

export interface Medium {
  id: string;
  name: string;
  hazardClass: string;
}

/** 一次装车（含复装）的版本快照 */
export interface LoadVersion {
  /** 从 1 开始，复装一次加一 */
  seq: number;
  startedAt: string;
  /** 该版本开始时的累计已装量 kg */
  startLoadedKg: number;
  /** 该版本中止时的累计已装量 kg；正常进行中为 null */
  endLoadedKg: number | null;
  endedAt: string | null;
  /** 中止原因，完成的版本记"装车完成" */
  reason: string | null;
  /** 是否因泄漏联动被系统中止 */
  byLeak: boolean;
}

/** 放行时与每次接地检查记录的接地参数 */
export interface GateRecord {
  at: string;
  operator: string;
  /** 接地电阻 Ω，>10 不放行 */
  resistanceOhm: number;
  /** 接地夹回讯是否正常 */
  clampFeedback: boolean;
  /** 放行时危化证是否有效 */
  licenseValid: boolean;
  passed: boolean;
  reasons: string[];
}

export interface DispatchTask {
  id: string;
  code: string;
  vehiclePlate: string;
  driverName: string;
  bayId: string;
  mediumId: string;
  /** 计划开始（datetime-local） */
  plannedStart: string;
  /** 计划结束（datetime-local） */
  plannedEnd: string;
  targetKg: number;
  /** 累计已装量 kg */
  loadedKg: number;
  status: TaskStatus;
  notes: string;
  createdAt: string;

  /** 放行/检查接地时的接地参数（整单不放行也保留） */
  resistanceOhm: number | null;
  clampFeedback: boolean | null;
  operator: string;
  /** 历次放行/接地检查 */
  gates: GateRecord[];
  /** 历次装车版本 */
  versions: LoadVersion[];
  /** 因泄漏事件联动中止时，关联的泄漏事件 id */
  leakEventId: string | null;
}

export interface LeakEvent {
  id: string;
  code: string;
  bayId: string;
  mediumId: string;
  level: "轻微" | "一般" | "较大";
  occurredAt: string;
  description: string;
  /** 已关闭则记录关闭时间；未关闭为 null（同装卸位不得接新任务） */
  closedAt: string | null;
  closeNotes: string;
}

export interface DispatchDraft {
  vehiclePlate: string;
  driverName: string;
  bayId: string;
  mediumId: string;
  plannedStart: string;
  plannedEnd: string;
  targetKg: number | string;
  notes: string;
  operator: string;
  resistanceOhm: number | string;
  clampFeedback: boolean;
}

/** 规则判定结果 */
export interface GateResult {
  passed: boolean;
  reasons: string[];
  licenseValid: boolean;
}
