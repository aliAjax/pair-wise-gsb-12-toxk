<script setup lang="ts">
import { computed, ref } from "vue";
import { bays } from "../data/vehicles";
import { useConsoleStore } from "../stores/console";
import TaskCard from "../components/TaskCard.vue";

const store = useConsoleStore();
const statusFilter = ref<"全部" | "待装车" | "装车中" | "已中止" | "已完成">("全部");
const bayFilter = ref<string>("全部");

const filteredTasks = computed(() =>
  store.tasks.filter((task) => {
    const statusOk = statusFilter.value === "全部" || task.status === statusFilter.value;
    const bayOk = bayFilter.value === "全部" || task.bayId === bayFilter.value;
    return statusOk && bayOk;
  })
);

const metrics = computed(() => [
  { label: "派车单总数", value: store.tasks.length, tone: "" },
  { label: "装车中", value: store.tasks.filter((t) => t.status === "装车中").length, tone: "live" },
  { label: "已中止待复装", value: store.tasks.filter((t) => t.status === "已中止").length, tone: "warn" },
  { label: "已完成", value: store.tasks.filter((t) => t.status === "已完成").length, tone: "ok" }
]);
</script>

<template>
  <section>
    <div class="metrics metrics-4">
      <article v-for="m in metrics" :key="m.label" class="metric" :class="m.tone">
        <span>{{ m.label }}</span>
        <strong>{{ m.value }}</strong>
      </article>
    </div>

    <div class="toolbar panel-tight">
      <div class="filter-group">
        <label>状态
          <select v-model="statusFilter">
            <option>全部</option>
            <option>待装车</option>
            <option>装车中</option>
            <option>已中止</option>
            <option>已完成</option>
          </select>
        </label>
        <label>装卸位
          <select v-model="bayFilter">
            <option value="全部">全部装卸位</option>
            <option v-for="b in bays" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </label>
      </div>
      <p class="toolbar-tip">装车中若接地电阻超过 10Ω 或接地夹失去回讯，系统立即中止并冻结版本、已装量与原因。</p>
    </div>

    <div v-if="filteredTasks.length === 0" class="empty panel">暂无匹配的派车单</div>
    <div v-else class="task-grid">
      <TaskCard v-for="task in filteredTasks" :key="task.id" :task="task" />
    </div>
  </section>
</template>
