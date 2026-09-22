<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Task } from "../types";
import { isGroundingSafe, MAX_GROUNDING_RESISTANCE } from "../rules/safety";
import { useConsoleStore } from "../stores/console";

const props = defineProps<{ task: Task }>();
const store = useConsoleStore();

const resistance = ref(String(props.task.grounding.resistance));
const clampConnected = ref(props.task.grounding.clampConnected);
const flash = ref<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.task.grounding,
  (reading) => {
    resistance.value = String(reading.resistance);
    clampConnected.value = reading.clampConnected;
  }
);

const safe = computed(() =>
  isGroundingSafe({ resistance: Number(resistance.value) || 0, clampConnected: clampConnected.value })
);

const editable = computed(() => props.task.status !== "已完成");

function pushReading() {
  const value = Number(resistance.value);
  if (Number.isNaN(value)) return;
  const result = store.updateGrounding(props.task.id, value, clampConnected.value);
  flash.value = result.ok ? "接地读数已同步" : result.reasons.join("；");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flash.value = null), 3600);
}
</script>

<template>
  <div class="grounding" :class="{ unsafe: !safe, safe: safe }">
    <div class="grounding-head">
      <span class="dot" />
      <strong>接地监控</strong>
      <span class="grounding-state">{{ safe ? "安全" : "异常" }}</span>
    </div>
    <div class="grounding-body">
      <label>
        接地电阻（Ω，阈值 {{ MAX_GROUNDING_RESISTANCE }}）
        <input
          v-model="resistance"
          type="number"
          min="0"
          step="0.1"
          :disabled="!editable"
          @change="pushReading"
        />
      </label>
      <label class="clamp-line">
        接地夹回讯
        <button
          type="button"
          class="chip"
          :class="clampConnected ? 'chip-on' : 'chip-off'"
          :disabled="!editable"
          @click="clampConnected = !clampConnected; pushReading()"
        >
          {{ clampConnected ? "已夹合回讯" : "未回讯" }}
        </button>
      </label>
    </div>
    <p v-if="flash" class="grounding-flash" :class="{ alarm: !safe }">{{ flash }}</p>
  </div>
</template>
