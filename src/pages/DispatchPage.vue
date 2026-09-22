<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { bays, drivers, getVehicle, mediumsOfVehicle, MEDIUMS, vehicles } from "../data/vehicles";
import { evaluateDispatchGate, MAX_GROUNDING_RESISTANCE } from "../rules/safety";
import { hoursLaterLocal, nowLocal } from "../utils/format";
import { useConsoleStore } from "../stores/console";
import type { DispatchDraft } from "../types";

const store = useConsoleStore();

const form = reactive<DispatchDraft>(
  store.draft ?? {
    vehicleId: "",
    driverId: drivers[0].id,
    bayId: "",
    medium: "",
    plannedQuantity: 20,
    windowStart: nowLocal(),
    windowEnd: hoursLaterLocal(2),
    resistance: null,
    clampConnected: false,
    notes: ""
  }
);

const resultMessage = ref<{ ok: boolean; text: string } | null>(null);

const permittedMediums = computed(() => (form.vehicleId ? mediumsOfVehicle(form.vehicleId) : []));
const selectedVehicle = computed(() => (form.vehicleId ? getVehicle(form.vehicleId) : undefined));

const gate = computed(() => {
  // 检查清单与提交共用同一套判定规则
  return evaluateDispatchGate(
    {
      vehicleId: form.vehicleId,
      driverId: form.driverId,
      bayId: form.bayId,
      medium: form.medium,
      plannedQuantity: form.plannedQuantity,
      windowStart: form.windowStart,
      windowEnd: form.windowEnd,
      resistance: form.resistance,
      clampConnected: form.clampConnected
    },
    store.leakEvents
  );
});

const checklist = computed(() => [
  {
    label: "装卸位无未关闭泄漏事件",
    failing: gate.value.reasons.some((r) => r.includes("泄漏"))
  },
  {
    label: `接地电阻 ≤ ${MAX_GROUNDING_RESISTANCE}Ω`,
    failing: gate.value.reasons.some((r) => r.includes("接地电阻"))
  },
  {
    label: "接地夹已夹合并回讯",
    failing: gate.value.reasons.some((r) => r.includes("接地夹"))
  },
  {
    label: "司机危化证在有效期内",
    failing: gate.value.reasons.some((r) => r.includes("危化证"))
  },
  {
    label: "介质与罐车核定范围一致、未超核载",
    failing: gate.value.reasons.some((r) => r.includes("核定介质") || r.includes("核载"))
  },
  {
    label: "作业时段与装车量完整有效",
    failing: gate.value.reasons.some((r) => r.includes("时段") || r.includes("装车量"))
  }
]);

function onVehicleChange() {
  const mediums = mediumsOfVehicle(form.vehicleId);
  if (mediums.length && !mediums.includes(form.medium)) {
    form.medium = mediums[0];
  }
}

function submit() {
  const result = store.registerDispatch(JSON.parse(JSON.stringify(form)) as DispatchDraft);
  if (!result.ok) {
    // 关键：不放行时不重置表单，整单输入原样保留
    resultMessage.value = { ok: false, text: result.reasons.join("；") };
    return;
  }
  resultMessage.value = { ok: true, text: `派车单 ${result.orderNo} 已放行，进入待装车队列` };
  Object.assign(form, {
    vehicleId: "",
    driverId: drivers[0].id,
    bayId: "",
    medium: "",
    plannedQuantity: 20,
    windowStart: nowLocal(),
    windowEnd: hoursLaterLocal(2),
    resistance: null,
    clampConnected: false,
    notes: ""
  });
}
</script>

<template>
  <div class="page-grid">
    <form class="panel dispatch-form" @submit.prevent="submit">
      <h2>派车单登记</h2>
      <p class="panel-hint">登记罐车、司机、装卸位、介质与时段，并录入放行前接地读数；任一安全项不满足则整单不放行，输入原样保留。</p>

      <div class="form-section">
        <p class="section-title">车辆与人员</p>
        <div class="form-grid-2">
          <label>
            罐车
            <select v-model="form.vehicleId" required @change="onVehicleChange">
              <option value="">请选择罐车</option>
              <option v-for="v in vehicles" :key="v.id" :value="v.id">
                {{ v.plate }}（核载 {{ v.capacity }}t · {{ v.permittedMediums.join("/") }}）
              </option>
            </select>
          </label>
          <label>
            司机（危化证）
            <select v-model="form.driverId" required>
              <option v-for="d in drivers" :key="d.id" :value="d.id">
                {{ d.name }}（证至 {{ d.hazmatCertExpiry }}）
              </option>
            </select>
          </label>
        </div>
      </div>

      <div class="form-section">
        <p class="section-title">装卸作业</p>
        <div class="form-grid-2">
          <label>
            装卸位
            <select v-model="form.bayId" required>
              <option value="">请选择装卸位</option>
              <option v-for="b in bays" :key="b.id" :value="b.id" :disabled="store.bayLocked(b.id)">
                {{ b.name }}（{{ b.zone }}）{{ store.bayLocked(b.id) ? "—— 泄漏锁定中" : "" }}
              </option>
            </select>
          </label>
          <label>
            充装介质
            <select v-model="form.medium" required>
              <option value="">请选择介质</option>
              <option v-for="m in (permittedMediums.length ? permittedMediums : MEDIUMS)" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <label>
            计划装车量（吨）
            <input v-model.number="form.plannedQuantity" type="number" min="0.5" step="0.5" required />
            <small v-if="selectedVehicle" class="inline-hint">该罐车核载 {{ selectedVehicle.capacity }}t</small>
          </label>
          <div class="form-grid-2">
            <label>
              时段开始
              <input v-model="form.windowStart" type="datetime-local" required />
            </label>
            <label>
              时段结束
              <input v-model="form.windowEnd" type="datetime-local" required />
            </label>
          </div>
        </div>
      </div>

      <div class="form-section">
        <p class="section-title">放行前接地检测</p>
        <div class="form-grid-2">
          <label>
            接地电阻（Ω，阈值 {{ MAX_GROUNDING_RESISTANCE }}）
            <input v-model.number="form.resistance" type="number" min="0" step="0.1" placeholder="如 4.2" required />
          </label>
          <label>
            接地夹回讯
            <button
              type="button"
              class="chip"
              :class="form.clampConnected ? 'chip-on' : 'chip-off'"
              @click="form.clampConnected = !form.clampConnected"
            >
              {{ form.clampConnected ? "已夹合回讯" : "未回讯（点击切换）" }}
            </button>
          </label>
        </div>
      </div>

      <label class="full-label">
        备注
        <textarea v-model="form.notes" placeholder="随车单据、现场交底或其他说明" />
      </label>

      <div v-if="resultMessage" class="alert" :class="resultMessage.ok ? 'alert-ok' : 'alert-block'">
        <strong>{{ resultMessage.ok ? "已放行" : "整单不放行" }}</strong>
        <span>{{ resultMessage.text }}</span>
      </div>

      <button class="submit-btn" type="submit">校验并放行派车单</button>
    </form>

    <aside class="panel gate-panel">
      <h2>放行闸门</h2>
      <ul class="checklist">
        <li v-for="item in checklist" :key="item.label" :class="{ pass: !item.failing }">
          <span class="check-icon">{{ item.failing ? "✕" : "✓" }}</span>
          <span>{{ item.label }}</span>
        </li>
      </ul>
      <div v-if="gate.reasons.length" class="gate-reasons">
        <p>当前拦截原因：</p>
        <ul>
          <li v-for="reason in gate.reasons" :key="reason">{{ reason }}</li>
        </ul>
      </div>
      <div v-else class="gate-ok">全部安全项满足，可以放行。</div>
    </aside>
  </div>
</template>
