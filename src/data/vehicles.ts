// 车辆资料层：司机、罐车、装卸位、介质基础台账
// 页面与判定规则都只通过这里引用基础数据，不直接写死资料。
import type { Driver, LoadingBay, TankVehicle } from "../types";

/** 危化品介质目录 */
export const MEDIUMS = ["柴油", "汽油", "甲醇", "液碱"] as const;

export const drivers: Driver[] = [
  { id: "d-01", name: "董飞", licenseNo: "沪危驾310102", hazmatCertExpiry: "2027-04-18" },
  { id: "d-02", name: "周航", licenseNo: "沪危驾310457", hazmatCertExpiry: "2025-11-30" },
  { id: "d-03", name: "梁坤", licenseNo: "沪危驾310779", hazmatCertExpiry: "2024-08-09" }
];

export const vehicles: TankVehicle[] = [
  { id: "v-01", plate: "沪A·D826挂", permittedMediums: ["柴油", "汽油"], capacity: 30, tankInspectionExpiry: "2026-05-20" },
  { id: "v-02", plate: "沪B·X731挂", permittedMediums: ["甲醇"], capacity: 25, tankInspectionExpiry: "2026-02-11" },
  { id: "v-03", plate: "沪C·K590挂", permittedMediums: ["液碱"], capacity: 28, tankInspectionExpiry: "2027-01-30" }
];

export const bays: LoadingBay[] = [
  { id: "b-01", name: "1号鹤位", zone: "东区" },
  { id: "b-02", name: "2号鹤位", zone: "东区" },
  { id: "b-03", name: "3号鹤位", zone: "西区" },
  { id: "b-04", name: "4号鹤位", zone: "西区" }
];

export function getDriver(id: string): Driver | undefined {
  return drivers.find((item) => item.id === id);
}

export function getVehicle(id: string): TankVehicle | undefined {
  return vehicles.find((item) => item.id === id);
}

export function getBay(id: string): LoadingBay | undefined {
  return bays.find((item) => item.id === id);
}

/** 车辆允许介质列表（便于派车页联动） */
export function mediumsOfVehicle(vehicleId: string): readonly string[] {
  return getVehicle(vehicleId)?.permittedMediums ?? [];
}
