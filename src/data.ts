import type { Driver, LoadBay, Medium, TankVehicle } from "./types";

// 基础资料：车辆、司机、装卸位、介质（与判定规则、页面分离，便于后续接接口）

export const MEDIA: Medium[] = [
  { id: "M01", name: "92号汽油", hazardClass: "第3类 易燃液体" },
  { id: "M02", name: "0号柴油", hazardClass: "第3类 易燃液体" },
  { id: "M03", name: "甲醇", hazardClass: "第3类 易燃液体" },
  { id: "M04", name: "液碱(32%)", hazardClass: "第8类 腐蚀性物质" },
  { id: "M05", name: "液氨", hazardClass: "第2.3类 毒性气体" }
];

export const TANK_VEHICLES: TankVehicle[] = [
  { plate: "沪D·G8216 挂", allowedMedia: ["M01", "M02"], capacityKg: 30000, inspectedAt: "2026-04-10" },
  { plate: "沪D·H7309 挂", allowedMedia: ["M01", "M02", "M03"], capacityKg: 28000, inspectedAt: "2026-07-22" },
  { plate: "苏E·X2051 挂", allowedMedia: ["M04"], capacityKg: 25000, inspectedAt: "2025-11-30" },
  { plate: "浙A·Y6608 挂", allowedMedia: ["M05"], capacityKg: 22000, inspectedAt: "2026-01-15" }
];

export const DRIVERS: Driver[] = [
  // 今天为 2026-09-22：前两位证件有效，后两位分别演示过期/临界
  { name: "董飞", licenseNo: "沪危驾31010219", licenseExpire: "2027-03-31" },
  { name: "周航", licenseNo: "沪危驾31011874", licenseExpire: "2026-12-15" },
  { name: "孙立军", licenseNo: "苏危驾32050662", licenseExpire: "2026-08-01" },
  { name: "罗海峰", licenseNo: "浙危驾33010947", licenseExpire: "2026-09-22" }
];

export const LOAD_BAYS: LoadBay[] = [
  { id: "B1", name: "1号鹤位（汽油）", allowedMedia: ["M01", "M02"] },
  { id: "B2", name: "2号鹤位（甲醇）", allowedMedia: ["M03"] },
  { id: "B3", name: "3号鹤位（碱液）", allowedMedia: ["M04"] },
  { id: "B4", name: "4号鹤位（液氨）", allowedMedia: ["M05"] }
];

export function findVehicle(plate: string) {
  return TANK_VEHICLES.find((v) => v.plate === plate);
}

export function findDriver(name: string) {
  return DRIVERS.find((d) => d.name === name);
}

export function findBay(id: string) {
  return LOAD_BAYS.find((b) => b.id === id);
}

export function findMedium(id: string) {
  return MEDIA.find((m) => m.id === id);
}
