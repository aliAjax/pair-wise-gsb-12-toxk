<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { bays, getBay, MEDIUMS } from "../data/vehicles";
import { useConsoleStore } from "../stores/console";
import { formatDateTime } from "../utils/format";
import StatusBadge from "../components/StatusBadge.vue";
import type { LeakEvent } from "../types";

const store = useConsoleStore();

const form = reactive({
  bayId: "",
  medium: MEDIUMS[0],
  level: "小量泄漏" as LeakEvent["level"],
  description: ""
});

const reportError = ref("");
const closingId = ref<string | null>(null);
const closeNotes = reactive<Record<string, string>>({});

const openEvents = computed(() => store.leakEvents.filter((e) => e.status === "处理中"));
const closedEvents = computed(() => store.leakEvents.filter((e) => e.status === "已关闭"));

function report() {
  reportError.value = "";
  if (!form.bayId) {
    reportError.value = "请选择发生泄漏的装卸位";
    return;
  }
  if (!form.description.trim()) {
    reportError.value = "请简要描述泄漏情况与先期处置";
    return;
  }
  const result = store.reportLeak({
    bayId: form.bayId,
    medium: form.medium,
    level: form.level,
    description: form.description.trim()
  });
  if (!result.ok) {
    reportError.value = result.reasons.join("；");
    return;
  }
  form.description = "";
}

function closeEvent(event: LeakEvent) {
  store.closeLeak(event.id, closeNotes[event.id] ?? "");
  closingId.value = null;
}
</script>

<template>
  <div class="page-grid leak-layout">
    <form class="panel" @submit.prevent="report">
      <h2>泄漏事件上报</h2>
      <p class="panel-hint">事件关闭前，同装卸位不得接新任务；若该位正在装车，安全联锁将立即中止。</p>
      <div class="form-grid">
        <label>
          发生装卸位
          <select v-model="form.bayId" required>
            <option value="">请选择装卸位</option>
            <option v-for="b in bays" :key="b.id" :value="b.id" :disabled="store.bayLocked(b.id)">
              {{ b.name }}（{{ b.zone }}）{{ store.bayLocked(b.id) ? "—— 已有处理中事件" : "" }}
            </option>
          </select>
        </label>
        <label>
          泄漏介质
          <select v-model="form.medium">
            <option v-for="m in MEDIUMS" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
        <label>
          事件等级
          <select v-model="form.level">
            <option>小量泄漏</option>
            <option>一般泄漏</option>
            <option>较大泄漏</option>
          </select>
        </label>
        <label>
          现场情况与先期处置
          <textarea v-model="form.description" placeholder="如：法兰滴漏、已围堵吸附、正在切断物料来源…" />
        </label>
      </div>
      <p v-if="reportError" class="alert alert-block">{{ reportError }}</p>
      <button class="submit-btn danger-btn" type="submit">上报并联动锁定</button>
    </form>

    <div class="leak-side">
      <section class="panel">
        <h2>处理中（{{ openEvents.length }}）</h2>
        <div v-if="openEvents.length === 0" class="empty-inline">当前无未关闭泄漏事件，全部装卸位可派新任务。</div>
        <article v-for="event in openEvents" :key="event.id" class="leak-card open">
          <header>
            <strong>{{ getBay(event.bayId)?.name }} · {{ event.medium }} · {{ event.level }}</strong>
            <StatusBadge :status="event.status" />
          </header>
          <p>{{ event.description }}</p>
          <p class="leak-time">上报时间：{{ formatDateTime(event.reportedAt) }}</p>
          <p class="leak-lock">⛔ 同装卸位新任务已锁定，事件关闭后解除</p>
          <template v-if="closingId === event.id">
            <textarea v-model="closeNotes[event.id]" placeholder="处置措施、检测结果、关闭确认人" />
            <div class="inline-actions">
              <button type="button" @click="closeEvent(event)">确认关闭并解锁</button>
              <button type="button" class="secondary" @click="closingId = null">取消</button>
            </div>
          </template>
          <button v-else type="button" class="secondary" @click="closingId = event.id">处置完成，关闭事件</button>
        </article>
      </section>

      <section class="panel">
        <h2>已关闭（{{ closedEvents.length }}）</h2>
        <div v-if="closedEvents.length === 0" class="empty-inline">暂无已关闭事件。</div>
        <article v-for="event in closedEvents" :key="event.id" class="leak-card closed">
          <header>
            <strong>{{ getBay(event.bayId)?.name }} · {{ event.medium }} · {{ event.level }}</strong>
            <StatusBadge :status="event.status" />
          </header>
          <p>{{ event.description }}</p>
          <p class="leak-time">上报：{{ formatDateTime(event.reportedAt) }} ｜ 关闭：{{ formatDateTime(event.closedAt ?? "") }}</p>
          <p class="close-notes">关闭说明：{{ event.closeNotes }}</p>
        </article>
      </section>
    </div>
  </div>
</template>
