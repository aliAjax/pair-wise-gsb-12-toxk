<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useConsoleStore } from "../store";
import { findBay, findDriver, findMedium, findVehicle } from "../data";
import { formatDateTime, RESISTANCE_LIMIT_OHM } from "../rules";
import type { DispatchTask } from "../types";

const props = defineProps<{ task: DispatchTask }>();
const emit = defineEmits<{
  (e: "edit", task: DispatchTask): void;
  (e: "notify", message: string, type: "ok" | "err"): void;
}>();

const store = useConsoleStore();
const task = props.task;

const vehicle = computed(() => findVehicle(task.vehiclePlate));
const driver = computed(() => findDriver(task.driverName));
const bay = computed(() => findBay(task.bayId));
const medium = computed(() => findMedium(task.mediumId));
const blockingLeak = computed(() => store.bayBlocked(task.bayId));
const linkedLeak = computed(() =>
  task.leakEventId ? store.events.find((e) => e.id === task.leakEventId) : null
);

const kgInput = ref<number | string>(task.loadedKg || "");
const monitorResistance = ref<number | string>(task.resistanceOhm ?? "");
const monitorClamp = ref(Boolean(task.clampFeedback));
const abortReason = ref("");

watch(
  () => task.status,
  () => {
    kgInput.value = task.loadedKg || "";
    monitorResistance.value = task.resistanceOhm ?? "";
    monitorClamp.value = Boolean(task.clampFeedback);
  }
);

const progress = computed(() =>
  task.targetKg > 0 ? Math.min(100, Math.round((task.loadedKg / task.targetKg) * 100)) : 0
);

const activeVersion = computed(() => task.versions.find((v) => v.endedAt === null));

function start() {
  store.startLoading(task.id);
  emit("notify", `${task.code} 开始装车，版本 v${task.versions.length}`, "ok");
}

function resume() {
  if (blockingLeak.value) {
    emit("notify", `${blockingLeak.value.code} 未关闭，${bay.value?.name} 暂不能复装`, "err");
    return;
  }
  store.resumeLoading(task.id);
  emit("notify", `${task.code} 已复装，生成版本 v${task.versions.length}`, "ok");
}

function recordLoaded() {
  const outcome = store.updateLoaded(
    task.id,
    Number(kgInput.value),
    Number(monitorResistance.value),
    monitorClamp.value
  );
  if (outcome.ok) {
    emit("notify", `${task.code} 已装量已记录：${task.loadedKg}kg`, "ok");
  } else if (outcome.aborted) {
    abortReason.value = outcome.reasons[0] ?? "接地异常";
    emit("notify", `${task.code} 接地异常，装车已立即中止`, "err");
  } else {
    emit("notify", outcome.reasons.join("；"), "err");
  }
}

function manualAbort() {
  const reason = abortReason.value.trim() || "现场人工急停";
  store.abortLoading(
    task.id,
    Number(kgInput.value) || task.loadedKg,
    Number(monitorResistance.value) || 0,
    monitorClamp.value,
    reason,
    false
  );
  abortReason.value = "";
  emit("notify", `${task.code} 已人工中止：${reason}`, "err");
}

function complete() {
  const outcome = store.completeLoading(
    task.id,
    Number(kgInput.value),
    Number(monitorResistance.value),
    monitorClamp.value
  );
  emit("notify",
    outcome.ok ? `${task.code} 装车完成` : outcome.reasons.join("；"),
    outcome.ok ? "ok" : "err"
  );
}

const lastGate = computed(() => task.gates[task.gates.length - 1]);
</script>

<template>
  <article class="record" :class="`status-${task.status}`">
    <div class="record-head">
      <div>
        <p class="record-title">{{ task.code }}</p>
        <p class="sub">{{ bay?.name }} · {{ medium?.name }}（{{ medium?.hazardClass }}）</p>
      </div>
      <span class="status" :class="task.status">{{ task.status }}</span>
    </div>

    <div class="details">
      <span>罐车：{{ task.vehiclePlate }}（额定 {{ vehicle?.capacityKg }}kg）</span>
      <span>司机：{{ task.driverName }}</span>
      <span>危化证号：{{ driver?.licenseNo }}</span>
      <span>证件有效期至：{{ driver?.licenseExpire }}</span>
      <span>计划时段：{{ formatDateTime(task.plannedStart) }} – {{ formatDateTime(task.plannedEnd) }}</span>
      <span>值班员：{{ task.operator }}</span>
    </div>

    <div class="load-progress">
      <div class="progress-line">
        <span>已装 {{ task.loadedKg }}kg / 计划 {{ task.targetKg }}kg</span>
        <strong>{{ progress }}%</strong>
      </div>
      <div class="bar-track"><div class="bar-fill" :style="{ width: `${progress}%` }" /></div>
    </div>

    <p v-if="task.notes" class="note">备注：{{ task.notes }}</p>

    <div v-if="lastGate && !lastGate.passed" class="reject-box">
      <p>本次未放行原因：</p>
      <ul>
        <li v-for="(r, i) in lastGate.reasons" :key="i">✕ {{ r }}</li>
      </ul>
    </div>

    <div v-if="linkedLeak && !linkedLeak.closedAt" class="leak-link">
      被泄漏事件 {{ linkedLeak.code }} 联动中止，事件关闭后方可复装
    </div>
    <div v-else-if="task.status === '已中止' && blockingLeak" class="leak-link">
      {{ blockingLeak.code }} 未关闭，{{ bay?.name }} 处于封锁状态
    </div>

    <!-- 装车中接地监控 -->
    <div v-if="task.status === '装车中'" class="loading-console">
      <h4>接地监测 · 当前版本 v{{ activeVersion?.seq }}</h4>
      <div class="console-grid">
        <label>
          已装量 (kg)
          <input v-model="kgInput" type="number" min="0" :max="task.targetKg" step="50" />
        </label>
        <label>
          接地电阻 (Ω)
          <input
            v-model="monitorResistance"
            type="number"
            step="0.1"
            :class="{ bad: Number(monitorResistance) > RESISTANCE_LIMIT_OHM }"
          />
        </label>
        <label class="check-field">
          <span>接地夹回讯</span>
          <input v-model="monitorClamp" type="checkbox" :class="{ bad: !monitorClamp }" />
        </label>
        <label class="full">
          中止/急停原因
          <input v-model="abortReason" type="text" placeholder="接地断开自动填写，或人工填写" />
        </label>
      </div>
      <p class="console-rule">
        记录已装量时如接地电阻 &gt; {{ RESISTANCE_LIMIT_OHM }}Ω 或接地夹脱离，系统立即中止装车并封存当前已装量。
      </p>
      <div class="actions">
        <button type="button" @click="recordLoaded">记录已装量</button>
        <button type="button" class="danger" @click="manualAbort">立即中止</button>
        <button type="button" @click="complete">完成装车</button>
      </div>
    </div>

    <div v-else class="actions">
      <button v-if="task.status === '已放行'" type="button" @click="start">开始装车</button>
      <button
        v-if="task.status === '已中止'"
        type="button"
        :disabled="Boolean(blockingLeak)"
        @click="resume"
      >
        复装（新版本）
      </button>
      <button
        v-if="task.status === '待放行' || task.status === '已放行'"
        type="button"
        class="secondary"
        @click="emit('edit', task)"
      >
        整改 / 重新校验
      </button>
      <button v-if="task.status !== '装车中'" type="button" class="danger ghost" @click="store.removeTask(task.id)">
        删除
      </button>
    </div>

    <details class="history">
      <summary>接地检查记录（{{ task.gates.length }}）· 装车版本（{{ task.versions.length }}）</summary>
      <ol class="gate-list">
        <li v-for="(g, i) in task.gates" :key="i" :class="g.passed ? 'pass' : 'fail'">
          <span class="dot" />
          <div>
            <p>
              <strong>{{ g.passed ? "校验通过" : "未放行" }}</strong>
              · {{ formatDateTime(g.at) }} · {{ g.operator }}
            </p>
            <p>接地电阻 {{ g.resistanceOhm }}Ω · 接地夹{{ g.clampFeedback ? "回讯正常" : "未回讯" }} · 危化证{{ g.licenseValid ? "有效" : "过期" }}</p>
            <ul v-if="!g.passed">
              <li v-for="(r, j) in g.reasons" :key="j">{{ r }}</li>
            </ul>
          </div>
        </li>
      </ol>
      <ol v-if="task.versions.length" class="version-list">
        <li v-for="v in task.versions" :key="v.seq">
          <div class="version-head">
            <strong>v{{ v.seq }}</strong>
            <span :class="v.endedAt ? (v.byLeak ? 'tag-abort leak' : 'tag-abort') : 'tag-live'">
              {{ v.endedAt ? (v.reason === "装车完成" ? "已完成" : "已中止") : "进行中" }}
            </span>
            <span v-if="v.byLeak" class="leak-flag">泄漏联动</span>
          </div>
          <p>开始 {{ formatDateTime(v.startedAt) }}（起算 {{ v.startLoadedKg }}kg）</p>
          <p v-if="v.endedAt">
            结束 {{ formatDateTime(v.endedAt) }} · 封存已装 {{ v.endLoadedKg }}kg · 原因：{{ v.reason }}
          </p>
          <p v-else>当前已装 {{ task.loadedKg }}kg</p>
        </li>
      </ol>
    </details>
  </article>
</template>
