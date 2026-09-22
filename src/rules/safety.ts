// 判定规则层：接地判定、派车放行闸门、装卸位泄漏锁定
// 全部为纯函数，便于单独测试与复用；页面和状态层只调用这里的结论。
import type { GroundingReading, LeakEvent } from "../types";
import { getDriver, getVehicle } from "../data/vehicles";

/** 接地电阻允许上限：10 欧姆 */
export const MAX_GROUNDING_RESISTANCE = 10;

export interface GateInput {
  vehicleId: string;
  driverId: string;
  bayId: string;
  medium: string;
  plannedQuantity: number | null;
  windowStart: string;
  windowEnd: string;
  resistance: number | null;
  clampConnected: boolean;
}

export interface GateResult {
  allowed: boolean;
  reasons: string[];
}

/** 接地是否安全：电阻不超过 10Ω 且接地夹正常回讯 */
export function isGroundingSafe(reading: Pick<GroundingReading, "resistance" | "clampConnected">): boolean {
  return reading.resistance <= MAX_GROUNDING_RESISTANCE && reading.clampConnected;
}

/** 接地异常原因（装车中任一条件成立都必须立即中止） */
export function groundingFailureReasons(reading: Pick<GroundingReading, "resistance" | "clampConnected">): string[] {
  const reasons: string[] = [];
  if (reading.resistance > MAX_GROUNDING_RESISTANCE) {
    reasons.push(`接地电阻 ${reading.resistance}Ω 超过 ${MAX_GROUNDING_RESISTANCE}Ω`);
  }
  if (!reading.clampConnected) {
    reasons.push("接地夹未回讯");
  }
  return reasons;
}

/** 危化证是否在有效期内（截止日当天仍有效） */
export function isHazmatCertValid(expiry: string, today: Date = new Date()): boolean {
  const end = new Date(`${expiry}T23:59:59`);
  return end.getTime() >= today.getTime();
}

/** 该装卸位是否存在尚未关闭的泄漏事件 */
export function openLeakOfBay(events: LeakEvent[], bayId: string): LeakEvent | undefined {
  return events.find((event) => event.bayId === bayId && event.status === "处理中");
}

/** 装卸位是否被泄漏事件锁定 */
export function isBayLocked(events: LeakEvent[], bayId: string): boolean {
  return openLeakOfBay(events, bayId) !== undefined;
}

/**
 * 派车放行闸门，任一条件不满足即整单不放行：
 * 1. 同装卸位有泄漏事件未关闭；
 * 2. 接地电阻超过 10Ω；
 * 3. 接地夹未回讯；
 * 4. 司机危化品从业资格证已过期；
 * 5. 介质不在罐车核定充装范围内；
 * 6. 计划量、时段不完整或时段倒置。
 */
export function evaluateDispatchGate(input: GateInput, leakEvents: LeakEvent[]): GateResult {
  const reasons: string[] = [];

  if (openLeakOfBay(leakEvents, input.bayId)) {
    reasons.push("该装卸位泄漏事件尚未关闭，不得接新任务");
  }

  if (input.resistance === null || Number.isNaN(input.resistance)) {
    reasons.push("请录入接地电阻读数");
  } else if (input.resistance > MAX_GROUNDING_RESISTANCE) {
    reasons.push(`接地电阻 ${input.resistance}Ω 超过 ${MAX_GROUNDING_RESISTANCE}Ω，不予放行`);
  }

  if (!input.clampConnected) {
    reasons.push("接地夹未回讯，不予放行");
  }

  const driver = getDriver(input.driverId);
  if (driver && !isHazmatCertValid(driver.hazmatCertExpiry)) {
    reasons.push(`司机${driver.name}危化证已于 ${driver.hazmatCertExpiry} 过期，不予放行`);
  }

  const vehicle = getVehicle(input.vehicleId);
  if (vehicle && !vehicle.permittedMediums.includes(input.medium)) {
    reasons.push(`${vehicle.plate} 核定介质为 ${vehicle.permittedMediums.join("、")}，不可充装${input.medium}`);
  }

  if (input.plannedQuantity === null || input.plannedQuantity <= 0) {
    reasons.push("请填写有效的计划装车量");
  } else if (vehicle && input.plannedQuantity > vehicle.capacity) {
    reasons.push(`计划量 ${input.plannedQuantity}t 超出罐车核载 ${vehicle.capacity}t`);
  }

  if (!input.windowStart || !input.windowEnd) {
    reasons.push("请选择完整的作业时段");
  } else if (new Date(input.windowEnd).getTime() <= new Date(input.windowStart).getTime()) {
    reasons.push("作业时段结束时间必须晚于开始时间");
  }

  return { allowed: reasons.length === 0, reasons };
}
