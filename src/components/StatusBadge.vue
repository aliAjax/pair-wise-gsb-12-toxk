<script setup lang="ts">
import type { TaskStatus } from "../types";

defineProps<{ status: TaskStatus | "处理中" | "已关闭" }>();
</script>

<template>
  <span class="status" :class="`st-${status}`">{{ status }}</span>
</template>
