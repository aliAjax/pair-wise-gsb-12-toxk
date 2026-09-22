<script setup lang="ts">
import { computed, ref } from "vue";
import { useConsoleStore } from "./stores/console";
import DispatchPage from "./pages/DispatchPage.vue";
import MonitorPage from "./pages/MonitorPage.vue";
import LeakPage from "./pages/LeakPage.vue";

type Tab = "dispatch" | "monitor" | "leak";

const tab = ref<Tab>("dispatch");
const store = useConsoleStore();

const tabs: { key: Tab; label: string }[] = [
  { key: "dispatch", label: "派车登记" },
  { key: "monitor", label: "装车 / 接地监控" },
  { key: "leak", label: "泄漏应急联动" }
];

const openLeakCount = computed(() => store.openLeakCount);
const activeLoadingCount = computed(() => store.tasks.filter((t) => t.status === "装车中").length);

function resetDemo() {
  if (window.confirm("将清空当前台账并恢复演示数据，是否继续？")) {
    store.resetDemo();
  }
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">危化品物流 · 安全联锁最小闭环</p>
          <h1>危化品装卸接地与泄漏应急联动台</h1>
          <p class="subtitle">
            派车单登记罐车、司机、装卸位、介质与时段；接地电阻超 10Ω、接地夹未回讯或司机危化证过期，整单不放行并保留输入。
            装车中接地断开立即中止并记录已装量、原因与复装版本；泄漏事件关闭前同装卸位锁定新任务。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Pinia</span>
          <span class="tag">TypeScript</span>
          <span class="tag">localStorage 持久化</span>
        </div>
      </header>

      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }}
          <em v-if="t.key === 'monitor' && activeLoadingCount" class="tab-badge live">{{ activeLoadingCount }}</em>
          <em v-if="t.key === 'leak' && openLeakCount" class="tab-badge alarm">{{ openLeakCount }}</em>
        </button>
        <button type="button" class="reset-btn" @click="resetDemo">恢复演示数据</button>
      </nav>

      <DispatchPage v-if="tab === 'dispatch'" />
      <MonitorPage v-else-if="tab === 'monitor'" />
      <LeakPage v-else />
    </div>
  </main>
</template>
