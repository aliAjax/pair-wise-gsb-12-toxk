<script setup lang="ts">
import { computed, ref } from "vue";
import { useConsoleStore } from "../store";
import type { DispatchTask } from "../types";
import TaskCard from "./TaskCard.vue";

const emit = defineEmits<{
  (e: "edit", task: DispatchTask): void;
  (e: "notify", message: string, type: "ok" | "err"): void;
}>();

const store = useConsoleStore();
const statusFilter = ref("全部状态");
const bayFilter = ref("全部装卸位");

const statusOptions = ["全部状态", "待放行", "已放行", "装车中", "已中止", "已完成"];

const filtered = computed(() =>
  store.tasks.filter((t) => {
    if (statusFilter.value !== "全部状态" && t.status !== statusFilter.value) return false;
    if (bayFilter.value !== "全部装卸位" && t.bayId !== bayFilter.value) return false;
    return true;
  })
);

const statusCount = (status: string) => store.tasks.filter((t) => t.status === status).length;

function forwardNotify(message: string, type: "ok" | "err") {
  emit("notify", message, type);
}
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>派车单 / 装车任务</h2>
      <div class="filters">
        <select v-model="statusFilter">
          <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="bayFilter">
          <option value="全部装卸位">全部装卸位</option>
          <option v-for="b in store.bays" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
    </div>

    <div class="status-chips">
      <span :class="{ on: statusFilter === '待放行' }" @click="statusFilter = '待放行'">待放行 {{ statusCount("待放行") }}</span>
      <span :class="{ on: statusFilter === '已放行' }" @click="statusFilter = '已放行'">已放行 {{ statusCount("已放行") }}</span>
      <span :class="{ on: statusFilter === '装车中' }" @click="statusFilter = '装车中'">装车中 {{ statusCount("装车中") }}</span>
      <span :class="{ on: statusFilter === '已中止' }" @click="statusFilter = '已中止'">已中止 {{ statusCount("已中止") }}</span>
      <span :class="{ on: statusFilter === '已完成' }" @click="statusFilter = '已完成'">已完成 {{ statusCount("已完成") }}</span>
    </div>

    <div class="record-grid">
      <div v-if="filtered.length === 0" class="empty">暂无匹配任务</div>
      <TaskCard
        v-for="task in filtered"
        :key="task.id"
        :task="task"
        @edit="emit('edit', $event)"
        @notify="forwardNotify"
      />
    </div>
  </section>
</template>
