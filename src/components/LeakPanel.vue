<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useConsoleStore } from "../store";
import { findBay, findMedium } from "../data";
import { formatDateTime } from "../rules";

const emit = defineEmits<{ (e: "notify", message: string, type: "ok" | "err"): void }>();

const store = useConsoleStore();

const form = reactive({
  bayId: store.bays[0]?.id ?? "",
  mediumId: store.media[0]?.id ?? "",
  level: "一般" as "轻微" | "一般" | "较大",
  description: ""
});

const closingId = ref<string | null>(null);
const closeNotes = ref("");

const sortedEvents = computed(() =>
  [...store.events].sort((a, b) => {
    if (Boolean(a.closedAt) !== Boolean(b.closedAt)) return a.closedAt ? 1 : -1;
    return b.occurredAt.localeCompare(a.occurredAt);
  })
);

function report() {
  if (!form.description.trim()) {
    emit("notify", "请填写泄漏情况描述", "err");
    return;
  }
  const event = store.reportLeak({ ...form });
  form.description = "";
  emit(
    "notify",
    `${event.code} 已登记，${findBay(event.bayId)?.name} 封锁，装车中任务联动中止`,
    "err"
  );
}

function startClose(id: string) {
  closingId.value = id;
  closeNotes.value = "泄漏处置完成，现场冲洗检测合格。";
}

function confirmClose() {
  if (!closingId.value) return;
  store.closeLeak(closingId.value, closeNotes.value);
  const event = store.events.find((e) => e.id === closingId.value);
  closingId.value = null;
  closeNotes.value = "";
  emit("notify", `${event?.code} 已关闭，装卸位解除封锁`, "ok");
}

function blockedTaskCount(bayId: string) {
  return store.tasks.filter(
    (t) =>
      t.bayId === bayId &&
      (t.status === "已中止" || t.status === "已放行" || t.status === "待放行")
  ).length;
}
</script>

<template>
  <section class="panel leak-panel">
    <div class="panel-head">
      <h2>泄漏应急联动</h2>
      <span class="hint" v-if="store.openLeakEvents.length">
        {{ store.openLeakEvents.length }} 起未关闭
      </span>
    </div>

    <form class="form-grid" @submit.prevent="report">
      <label>
        泄漏装卸位
        <select v-model="form.bayId" required>
          <option v-for="b in store.bays" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </label>
      <label>
        泄漏介质
        <select v-model="form.mediumId" required>
          <option v-for="m in store.media" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </label>
      <label>
        事件等级
        <select v-model="form.level">
          <option value="轻微">轻微</option>
          <option value="一般">一般</option>
          <option value="较大">较大</option>
        </select>
      </label>
      <label class="full">
        泄漏情况
        <textarea v-model="form.description" placeholder="部位、估计量、现场措施……" required />
      </label>
      <button class="danger" type="submit">登记泄漏并联动中止同装卸位装车</button>
    </form>

    <div class="event-list">
      <article v-for="event in sortedEvents" :key="event.id" class="event" :class="{ open: !event.closedAt }">
        <div class="record-head">
          <div>
            <p class="record-title">{{ event.code }}</p>
            <p class="sub">
              {{ findBay(event.bayId)?.name }} · {{ findMedium(event.mediumId)?.name }} · {{ event.level }}
            </p>
          </div>
          <span class="status" :class="event.closedAt ? '已完成' : '已中止'">
            {{ event.closedAt ? "已关闭" : "处置中" }}
          </span>
        </div>
        <p class="note">发生于 {{ formatDateTime(event.occurredAt) }}：{{ event.description }}</p>
        <p v-if="!event.closedAt" class="leak-link">
          该装卸位已封锁（关联待处理单 {{ blockedTaskCount(event.bayId) }} 张），关闭前不得接新任务
        </p>
        <p v-else class="close-note">
          关闭于 {{ formatDateTime(event.closedAt) }}：{{ event.closeNotes }}
        </p>

        <div v-if="!event.closedAt" class="actions">
          <template v-if="closingId === event.id">
            <input v-model="closeNotes" type="text" placeholder="关闭说明 / 检测结论" />
            <button type="button" class="secondary" @click="confirmClose">确认关闭</button>
            <button type="button" class="ghost-btn" @click="closingId = null">取消</button>
          </template>
          <button v-else type="button" class="secondary" @click="startClose(event.id)">处置完成，关闭事件</button>
        </div>
      </article>
    </div>
  </section>
</template>
