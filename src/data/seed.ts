// 初始演示数据：首次使用（或重置）时写入 localStorage
import type { LeakEvent, Task } from "../types";

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function minutesAgo(minutes: number): string {
  // datetime-local 格式
  const d = new Date(Date.now() - minutes * 60_000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function createSeedTasks(): Task[] {
  return [
    {
      id: "seed-task-1",
      orderNo: "PC-0001",
      vehicleId: "v-01",
      driverId: "d-01",
      bayId: "b-01",
      medium: "柴油",
      plannedQuantity: 20,
      loadedQuantity: 8,
      windowStart: minutesAgo(40),
      windowEnd: minutesAgo(-90),
      status: "装车中",
      version: 1,
      grounding: { resistance: 3.6, clampConnected: true, updatedAt: isoMinutesAgo(1) },
      aborts: [],
      notes: "刷新页面后装车状态、已装量与接地读数保持一致",
      createdAt: isoMinutesAgo(45),
      updatedAt: isoMinutesAgo(2)
    },
    {
      id: "seed-task-2",
      orderNo: "PC-0002",
      vehicleId: "v-02",
      driverId: "d-02",
      bayId: "b-02",
      medium: "甲醇",
      plannedQuantity: 18,
      loadedQuantity: 6.5,
      windowStart: minutesAgo(150),
      windowEnd: minutesAgo(-20),
      status: "已中止",
      version: 2,
      grounding: { resistance: 14.2, clampConnected: false, updatedAt: isoMinutesAgo(18) },
      aborts: [
        {
          version: 1,
          loadedQuantity: 6.5,
          reason: "装车中接地电阻升至 14.2Ω 超过 10Ω，且接地夹未回讯，系统立即中止",
          at: isoMinutesAgo(18)
        }
      ],
      notes: "待接地整改后从 v2 复装；复装不覆盖 v1 中止记录",
      createdAt: isoMinutesAgo(160),
      updatedAt: isoMinutesAgo(18)
    },
    {
      id: "seed-task-3",
      orderNo: "PC-0003",
      vehicleId: "v-03",
      driverId: "d-01",
      bayId: "b-03",
      medium: "液碱",
      plannedQuantity: 22,
      loadedQuantity: 22,
      windowStart: minutesAgo(320),
      windowEnd: minutesAgo(200),
      status: "已完成",
      version: 1,
      grounding: { resistance: 2.1, clampConnected: true, updatedAt: isoMinutesAgo(210) },
      aborts: [],
      notes: "整单完成，资料归档",
      createdAt: isoMinutesAgo(330),
      updatedAt: isoMinutesAgo(205)
    }
  ];
}

export function createSeedLeakEvents(): LeakEvent[] {
  return [
    {
      id: "seed-leak-1",
      bayId: "b-04",
      medium: "柴油",
      level: "小量泄漏",
      description: "鹤管法兰处滴漏，已围堵吸附，待更换垫片",
      reportedAt: isoMinutesAgo(35),
      status: "处理中"
    }
  ];
}

/** 种子数据之后的下一流水号 */
export const SEED_SEQUENCE = 3;
