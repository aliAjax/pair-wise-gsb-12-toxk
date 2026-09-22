<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useConsoleStore } from "../store";
import { evaluateGate, RESISTANCE_LIMIT_OHM } from "../rules";
import type { DispatchDraft, DispatchTask, GateSubmitOutcome } from "../types";

const props = defineProps<{ editing: DispatchTask | null }>();
const emit = defineEmits<{
  (e: "result", outcome: GateSubmitOutcome): void;
  (e: "cancel-edit"): void;
}>();

const store = useConsoleStore();

function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function blankDraft(): DispatchDraft {
  return {
    vehiclePlate: store.vehicles[0]?.plate ?? "",
    driverName: store.drivers[0]?.name ?? "",
    bayId: store.bays[0]?.id ?? "",
    mediumId: store.media[0]?.id ?? "",
    plannedStart: localInput(new Date(Date.now() + 30 * 60000)),
    plannedEnd: localInput(new Date(Date.now() + 150 * 60000)),
    targetKg: "",
    notes: "",
    operator: "",
    resistanceOhm: "",
    clampFeedback: true
  };
}

const form = reactive<DispatchDraft>(blankDraft());

watch(
  () => props.editing,
  (task) => {
    if (!task) return;
    form.vehiclePlate = task.vehiclePlate;
    form.driverName = task.driverName;
    form.bayId = task.bayId;
    form.mediumId = task.mediumId;
    form.plannedStart = task.plannedStart;
    form.plannedEnd = task.plannedEnd;
    form.targetKg = task.targetKg;
    form.notes = task.notes;
    form.operator = task.operator;
    form.resistanceOhm = task.resistanceOhm ?? "";
    form.clampFeedback = Boolean(task.clampFeedback);
  },
  { immediate: true }
);

// 实时预检：仅提示，真正裁定以提交时 evaluateGate 结果为准
const preview = computed(() => evaluateGate(form, store.tasks, store.events));

function reset() {
  Object.assign(form, blankDraft());
}

function submit() {
  const outcome = store.submitGate(form, props.editing?.id);
  if (outcome.ok) {
    reset();
    emit("cancel-edit");
  }
  // 不放行：不重置表单，输入原样保留
  emit("result", outcome);
}

function cancelEdit() {
  reset();
  emit("cancel-edit");
}
</script>

<template>
  <form class="panel dispatch-form" @submit.prevent="submit">
    <div class="panel-head">
      <h2>{{ editing ? "整改后重新校验" : "派车单登记" }}</h2>
      <span class="hint">接地电阻阈值 {{ RESISTANCE_LIMIT_OHM }}Ω</span>
    </div>

    <div v-if="editing" class="edit-banner">
      正在整改派车单 <strong>{{ editing.code }}</strong>
      <button type="button" class="link-btn" @click="cancelEdit">取消</button>
    </div>

    <div class="form-grid">
      <label>
        罐车
        <select v-model="form.vehiclePlate" required>
          <option v-for="v in store.vehicles" :key="v.plate" :value="v.plate">
            {{ v.plate }}（额定 {{ v.capacityKg }}kg）
          </option>
        </select>
      </label>

      <label>
        司机
        <select v-model="form.driverName" required>
          <option v-for="d in store.drivers" :key="d.name" :value="d.name">
            {{ d.name }}（危化证至 {{ d.licenseExpire }}）
          </option>
        </select>
      </label>

      <label>
        装卸位
        <select v-model="form.bayId" required>
          <option v-for="b in store.bays" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </label>

      <label>
        介质
        <select v-model="form.mediumId" required>
          <option v-for="m in store.media" :key="m.id" :value="m.id">
            {{ m.name }} · {{ m.hazardClass }}
          </option>
        </select>
      </label>

      <label>
        计划开始
        <input v-model="form.plannedStart" type="datetime-local" required />
      </label>

      <label>
        计划结束
        <input v-model="form.plannedEnd" type="datetime-local" required />
      </label>

      <label>
        计划装车量 (kg)
        <input v-model="form.targetKg" type="number" min="1" step="100" placeholder="如 28000" required />
      </label>

      <label>
        当班值班员
        <input v-model="form.operator" type="text" placeholder="接地检测/放行人" required />
      </label>

      <label class="ground-field">
        接地电阻 (Ω)
        <input
          v-model="form.resistanceOhm"
          type="number"
          min="0"
          max="100"
          step="0.1"
          placeholder="现场实测值"
          required
          :class="{ bad: form.resistanceOhm !== '' && Number(form.resistanceOhm) > RESISTANCE_LIMIT_OHM }"
        />
      </label>

      <label class="check-field">
        <span>接地夹回讯</span>
        <input v-model="form.clampFeedback" type="checkbox" :class="{ bad: !form.clampFeedback }" />
      </label>

      <label class="full">
        备注
        <textarea v-model="form.notes" placeholder="现场要求、随车资料等" />
      </label>
    </div>

    <!-- 实时预检提示，不放行项整单不可放行 -->
    <ul class="gate-preview" :class="preview.passed ? 'ok' : 'warn'">
      <li v-if="preview.passed">预检通过：可提交放行</li>
      <li v-for="(reason, i) in preview.reasons" :key="i">⚠ {{ reason }}</li>
    </ul>

    <button class="primary-btn" type="submit">{{ editing ? "重新校验放行" : "登记并校验放行" }}</button>
  </form>
</template>
