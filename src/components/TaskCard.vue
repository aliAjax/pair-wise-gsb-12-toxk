<script setup lang="ts">
import { computed, ref } from "vue";
import type { Task } from "../types";
import { getBay, getDriver, getVehicle, MEDIUMS } from "../data/vehicles";
import { isGroundingSafe, isHazmatCertValid } from "../rules/safety";
import { formatDateTime, formatSlot, formatTons } from "../utils/format";
import { useConsoleStore } from "../stores/console";
import GroundingControl from "./GroundingControl.vue";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{ task: Task }>();
const store = useConsoleStore();
const actionError = ref("");

const vehicle = computed(() => getVehicle(props.task.vehicleId));
const driver = computed(() => getDriver(props.task.driverId));
const bay = computed(() => getBay(props.task.bayId));
const certValid = computed(() => (driver.value ? isHazmatCertValid(driver.value.hazmatCertExpiry) : true));
const groundingSafe = computed(() => isGroundingSafe(props.task.grounding));
const bayLocked = computed(() => store.bayLocked(props.task.bayId));
const progress = computed(() =>
  Math.min(100, Math.round((props.task.loadedQuantity / Math.max(props.task.plannedQuantity, 1)) * 100))
);
const live = computed(() => store.isLive(props.task.id));

function run(action: () => { ok: boolean; reasons: string[] }) {
  const result = action();
  actionError.value = result.ok ? "" : result.reasons.join("；");
}

function start() {
  run(() => store.startLoading(props.task.id));
}
function continueLoad() {
  run(() => store.continueLoading(props.task.id));
}
function resume() {
  run(() => store.resumeLoading(props.task.id));
}
</script>

<template>
  <article class="task-card" :class="{ 'is-aborted': task.status === '已中止', 'is-done': task.status === '已完成' }">
    <header class="task-head">
      <div>
        <p class="task-no">
          {{ task.orderNo }}
          <span class="version-tag">装车 v{{ task.version }}</span>
        </p>
        <p class="task-title">{{ vehicle?.plate }} · {{ driver?.name }} · {{ bay?.name }}</p>
      </div>
      <StatusBadge :status="task.status" />
    </header>

    <div class="task-meta">
      <span>介质：<b>{{ task.medium }}</b></span>
      <span>装卸位：{{ bay?.name }}（{{ bay?.zone }}）
        <em v-if="bayLocked && task.status !== '已完成'" class="lock-flag">泄漏锁定中</em>
      </span>
      <span>
        司机危化证：
        <b :class="{ expired: !certValid }">{{ certValid ? "有效" : `已过期（${driver?.hazmatCertExpiry}）` }}</b>
      </span>
      <span>核载：{{ vehicle?.capacity }}t
        <em v-if="!vehicle?.permittedMediums.includes(task.medium as (typeof MEDIUMS)[number])" class="mismatch">介质不符</em>
      </span>
      <span>时段：{{ formatSlot(task.windowStart) }} ～ {{ formatSlot(task.windowEnd) }}</span>
      <span>已装/计划：{{ formatTons(task.loadedQuantity) }} / {{ formatTons(task.plannedQuantity) }}</span>
    </div>

    <div class="progress-track">
      <div class="progress-fill" :class="{ done: task.status === '已完成' }" :style="{ width: `${progress}%` }" />
    </div>

    <GroundingControl :task="task" />

    <div v-if="task.aborts.length" class="abort-log">
      <p class="abort-title">中止 / 复装记录</p>
      <ol>
        <li v-for="record in task.aborts" :key="record.version + record.at">
          <span class="abort-version">v{{ record.version }} 中止</span>
          <span class="abort-qty">已装 {{ formatTons(record.loadedQuantity) }}</span>
          <span class="abort-time">{{ formatDateTime(record.at) }}</span>
          <p class="abort-reason">{{ record.reason }}</p>
        </li>
      </ol>
      <p v-if="task.version > (task.aborts.at(-1)?.version ?? 0)" class="resume-note">
        当前复装版本 v{{ task.version }}（历史版本记录保留不变）
      </p>
    </div>

    <p v-if="task.notes && task.notes !== '暂无备注'" class="task-notes">{{ task.notes }}</p>
    <p v-if="actionError" class="action-error">⛔ {{ actionError }}</p>

    <footer class="task-actions">
      <button v-if="task.status === '待装车'" type="button" @click="start">开始装车</button>
      <button v-if="task.status === '装车中' && !live" type="button" @click="continueLoad">继续装车模拟</button>
      <span v-if="task.status === '装车中' && live" class="live-hint">● 装车进行中，接地异常将立即中止</span>
      <button
        v-if="task.status === '已中止'"
        type="button"
        :disabled="!groundingSafe"
        :title="groundingSafe ? '' : '接地未恢复安全，禁止复装'"
        @click="resume"
      >
        接地恢复后复装（v{{ task.version + 1 }}）
      </button>
      <span v-if="task.status === '已完成'" class="done-hint">✓ 整单完成，台账冻结</span>
    </footer>
  </article>
</template>
