import { findBay, findDriver, findMedium, findVehicle } from "./data";
import type { DispatchDraft, GateResult, LeakEvent, DispatchTask } from "./types";

// 判定规则：纯函数集中管理，页面只负责展示与触发，不自行裁定放行条件。

/** 接地电阻上限 Ω，超过即不放行/中止 */
export const RESISTANCE_LIMIT_OHM = 10;

/** 取本地日期 yyyy-mm-dd，用于证件有效期比较 */
function dateKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 危化证是否在有效期内（到期当日仍有效，次日起算过期） */
export function isLicenseValid(expireDate: string, now = new Date()): boolean {
  if (!expireDate) return false;
  return dateKey(now) <= expireDate;
}

/** 装卸位是否存在未关闭的泄漏事件；关闭前同装卸位不得接新任务 */
export function bayBlockedByLeak(bayId: string, events: LeakEvent[]): LeakEvent | null {
  return events.find((e) => e.bayId === bayId && e.closedAt === null) ?? null;
}

/** 同一时段同装卸位时间冲突（含交集即冲突） */
export function bayTimeConflict(
  bayId: string,
  start: string,
  end: string,
  tasks: DispatchTask[],
  excludeId?: string
): DispatchTask | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return (
    tasks.find((t) => {
      if (t.id === excludeId || t.bayId !== bayId || t.status === "已完成") return false;
      const ts = new Date(t.plannedStart).getTime();
      const te = new Date(t.plannedEnd).getTime();
      return s < te && ts < e;
    }) ?? null
  );
}

/**
 * 放行前规则校验（派车单登记）：
 * 接地电阻 > 10Ω、接地夹未回讯、司机危化证过期 → 整单不放行；
 * 另校验资料匹配、装卸位泄漏封锁、时段冲突。
 * 返回结果不产生副作用，输入由页面原样保留。
 */
export function evaluateGate(
  draft: DispatchDraft,
  tasks: DispatchTask[],
  events: LeakEvent[],
  now = new Date()
): GateResult {
  const reasons: string[] = [];

  const vehicle = findVehicle(draft.vehiclePlate);
  const driver = findDriver(draft.driverName);
  const bay = findBay(draft.bayId);
  const medium = findMedium(draft.mediumId);

  const resistance = Number(draft.resistanceOhm);
  if (!Number.isFinite(resistance) || resistance < 0) {
    reasons.push("接地电阻数值无效");
  } else if (resistance > RESISTANCE_LIMIT_OHM) {
    reasons.push(`接地电阻 ${resistance}Ω 超过 ${RESISTANCE_LIMIT_OHM}Ω 上限`);
  }
  if (!draft.clampFeedback) {
    reasons.push("接地夹未回讯");
  }

  const licenseValid = driver ? isLicenseValid(driver.licenseExpire, now) : false;
  if (!driver) {
    reasons.push("司机未建档，无法核验危化证");
  } else if (!licenseValid) {
    reasons.push(`司机危化证已于 ${driver.licenseExpire} 过期`);
  }

  if (!vehicle) reasons.push("罐车未建档");
  if (!bay) reasons.push("装卸位不存在");
  if (!medium) reasons.push("介质未建档");
  if (vehicle && medium && !vehicle.allowedMedia.includes(medium.id)) {
    reasons.push(`罐车 ${vehicle.plate} 不具备 ${medium.name} 承运资质`);
  }
  if (bay && medium && !bay.allowedMedia.includes(medium.id)) {
    reasons.push(`${bay.name} 不支持 ${medium.name} 装卸`);
  }

  const target = Number(draft.targetKg);
  if (!Number.isFinite(target) || target <= 0) {
    reasons.push("计划装车量必须大于 0");
  } else if (vehicle && target > vehicle.capacityKg) {
    reasons.push(`计划量 ${target}kg 超过罐车额定 ${vehicle.capacityKg}kg`);
  }

  if (draft.plannedStart && draft.plannedEnd && new Date(draft.plannedEnd) <= new Date(draft.plannedStart)) {
    reasons.push("计划时段结束时间必须晚于开始时间");
  }

  if (bay) {
    const blocking = bayBlockedByLeak(bay.id, events);
    if (blocking) reasons.push(`装卸位存在未关闭泄漏事件 ${blocking.code}，禁止接新任务`);
    const conflict = bayTimeConflict(bay.id, draft.plannedStart, draft.plannedEnd, tasks);
    if (conflict) reasons.push(`与派车单 ${conflict.code} 在该装卸位时段冲突`);
  }

  return { passed: reasons.length === 0, reasons, licenseValid };
}

/** 装车过程中的接地监测：任一条件不满足都必须立即中止装车 */
export function checkLoadingGround(
  resistanceOhm: number,
  clampFeedback: boolean
): { ok: boolean; reason: string | null } {
  if (!Number.isFinite(resistanceOhm) || resistanceOhm < 0) {
    return { ok: false, reason: "接地电阻监测值无效" };
  }
  if (!clampFeedback) return { ok: false, reason: "装车过程中接地夹脱离、回讯中断" };
  if (resistanceOhm > RESISTANCE_LIMIT_OHM) {
    return { ok: false, reason: `装车过程中接地电阻升至 ${resistanceOhm}Ω，超过 ${RESISTANCE_LIMIT_OHM}Ω` };
  }
  return { ok: true, reason: null };
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
