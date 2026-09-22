// 危化品装卸接地与泄漏应急联动台 —— 领域类型定义

/** 司机（含危化品运输从业资格证） */
export interface Driver {
  id: string;
  name: string;
  licenseNo: string;
  /** 危化品从业资格证有效期（YYYY-MM-DD） */
  hazmatCertExpiry: string;
}

/** 危化品罐车车辆资料 */
export interface TankVehicle {
  id: string;
  plate: string;
  /** 核定允许充装的介质 */
  permittedMediums: string[];
  /** 核定载量（吨） */
  capacity: number;
  /** 罐体检验有效期（YYYY-MM-DD） */
  tankInspectionExpiry: string;
}

/** 装卸位 */
export interface LoadingBay {
  id: string;
  name: string;
  zone: string;
}

/** 派车单状态 */
export type TaskStatus = "待装车" | "装车中" | "已中止" | "已完成";

/** 接地实时读数 */
export interface GroundingReading {
  /** 接地电阻（欧姆） */
  resistance: number;
  /** 接地夹回讯：true 已夹合回讯 */
  clampConnected: boolean;
  updatedAt: string;
}

/** 装车中止记录（对应一个装车版本） */
export interface AbortRecord {
  /** 中止时所处的装车版本 */
  version: number;
  /** 中止时已装量（吨） */
  loadedQuantity: number;
  /** 中止原因 */
  reason: string;
  at: string;
}

/** 派车单 / 装车任务 */
export interface Task {
  id: string;
  orderNo: string;
  vehicleId: string;
  driverId: string;
  bayId: string;
  medium: string;
  /** 计划装车量（吨） */
  plannedQuantity: number;
  /** 已装量（吨） */
  loadedQuantity: number;
  /** 计划作业时段（datetime-local） */
  windowStart: string;
  windowEnd: string;
  status: TaskStatus;
  /** 装车版本：首装为 1，每次复装 +1 */
  version: number;
  grounding: GroundingReading;
  aborts: AbortRecord[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** 泄漏事件 */
export interface LeakEvent {
  id: string;
  bayId: string;
  medium: string;
  level: "小量泄漏" | "一般泄漏" | "较大泄漏";
  description: string;
  reportedAt: string;
  status: "处理中" | "已关闭";
  closedAt?: string;
  closeNotes?: string;
}

/** 派车登记表单输入（未放行前保留在页面中） */
export interface DispatchDraft {
  vehicleId: string;
  driverId: string;
  bayId: string;
  medium: string;
  plannedQuantity: number | null;
  windowStart: string;
  windowEnd: string;
  resistance: number | null;
  clampConnected: boolean;
  notes: string;
}

/** 动作执行结果 */
export interface ActionResult {
  ok: boolean;
  reasons: string[];
  orderNo?: string;
}
