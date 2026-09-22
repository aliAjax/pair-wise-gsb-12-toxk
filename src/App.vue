<script setup lang="ts">
import { computed, ref } from "vue";
import { useConsoleStore } from "./store";
import DispatchForm from "./components/DispatchForm.vue";
import TaskBoard from "./components/TaskBoard.vue";
import LeakPanel from "./components/LeakPanel.vue";
import DirectoryPanel from "./components/DirectoryPanel.vue";
import type { DispatchTask, GateSubmitOutcome } from "./types";

const store = useConsoleStore();

type Tab = "dispatch" | "leak" | "directory";
const tab = ref<Tab>("dispatch");

const tabs: { key: Tab; label: string }[] = [
  { key: "dispatch", label: "派车与装车联动" },
  { key: "leak", label: "泄漏应急" },
  { key: "directory", label: "车辆资料" }
];

const editingTask = ref<DispatchTask | null>(null);

const toast = ref<{ message: string; type: "ok" | "err" } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function notify(message: string, type: "ok" | "err") {
  toast.value = { message, type };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 4200);
}

function onGateResult(outcome: GateSubmitOutcome) {
  if (outcome.ok) {
    notify(`校验通过，派车单已放行`, "ok");
  } else {
    notify(`整单未放行：${outcome.reasons.join("；")}（输入已保留，可修改后重新校验）`, "err");
  }
}

function startEdit(task: DispatchTask) {
  editingTask.value = task;
  tab.value = "dispatch";
  notify(`正在整改派车单 ${task.code}，修改后可重新校验放行`, "ok");
}

function switchTab(key: Tab) {
  tab.value = key;
}

const metrics = computed(() => store.metrics);
const metricCards = computed(() => [
  { label: "派车单总数", value: metrics.value.total },
  { label: "装车中", value: metrics.value.loading },
  { label: "待放行/已放行", value: metrics.value.pending },
  { label: "已中止待复装", value: metrics.value.aborted },
  { label: "未关闭泄漏", value: metrics.value.openLeaks }
]);
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">危化品仓储物流 · 装卸安全联动</p>
          <h1>危化品装卸接地与泄漏应急联动台</h1>
          <p class="subtitle">
            派车单登记罐车、司机、装卸位、介质与时段；接地电阻超 10Ω、接地夹未回讯或司机危化证过期整单不放行。
            装车中接地断开立即中止并封存已装量与版本；泄漏事件关闭前，同装卸位不得接新任务。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Pinia</span>
          <span class="tag">本地持久化</span>
        </div>
      </header>

      <section class="metrics">
        <article
          v-for="card in metricCards"
          :key="card.label"
          class="metric"
          :class="{ alert: card.label === '未关闭泄漏' && card.value > 0 }"
        >
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      </section>

      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="{ active: tab === t.key }"
          @click="switchTab(t.key)"
        >
          {{ t.label }}
          <em v-if="t.key === 'leak' && metrics.openLeaks > 0" class="badge">{{ metrics.openLeaks }}</em>
        </button>
      </nav>

      <transition name="fade">
        <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
      </transition>

      <section v-if="tab === 'dispatch'" class="workspace">
        <DispatchForm :editing="editingTask" @result="onGateResult" @cancel-edit="editingTask = null" />
        <TaskBoard @edit="startEdit" @notify="notify" />
      </section>

      <section v-else-if="tab === 'leak'" class="workspace single">
        <LeakPanel @notify="notify" />
      </section>

      <section v-else class="workspace single">
        <DirectoryPanel />
      </section>
    </div>
  </main>
</template>
