<script setup lang="ts">
import { useConsoleStore } from "../store";
import { isLicenseValid } from "../rules";

const store = useConsoleStore();

function mediumNames(ids: string[]) {
  return ids
    .map((id) => store.media.find((m) => m.id === id)?.name ?? id)
    .join("、");
}
</script>

<template>
  <section class="panel directory">
    <h2>车辆与人员资料</h2>
    <p class="hint">基础资料与判定规则、页面分离维护；以下为当前建档数据。</p>

    <h3>罐车</h3>
    <table>
      <thead>
        <tr><th>车牌号</th><th>可承运介质</th><th>额定载重</th><th>罐体检验日期</th></tr>
      </thead>
      <tbody>
        <tr v-for="v in store.vehicles" :key="v.plate">
          <td>{{ v.plate }}</td>
          <td>{{ mediumNames(v.allowedMedia) }}</td>
          <td>{{ v.capacityKg }} kg</td>
          <td>{{ v.inspectedAt }}</td>
        </tr>
      </tbody>
    </table>

    <h3>司机（危化品从业资格）</h3>
    <table>
      <thead>
        <tr><th>姓名</th><th>资格证号</th><th>证件有效期至</th><th>状态</th></tr>
      </thead>
      <tbody>
        <tr v-for="d in store.drivers" :key="d.licenseNo">
          <td>{{ d.name }}</td>
          <td>{{ d.licenseNo }}</td>
          <td>{{ d.licenseExpire }}</td>
          <td>
            <span class="status" :class="isLicenseValid(d.licenseExpire) ? '已完成' : '已中止'">
              {{ isLicenseValid(d.licenseExpire) ? "有效" : "已过期" }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <h3>装卸位</h3>
    <table>
      <thead>
        <tr><th>编号</th><th>名称</th><th>允许介质</th><th>泄漏封锁</th></tr>
      </thead>
      <tbody>
        <tr v-for="b in store.bays" :key="b.id">
          <td>{{ b.id }}</td>
          <td>{{ b.name }}</td>
          <td>{{ mediumNames(b.allowedMedia) }}</td>
          <td>
            <span v-if="store.bayBlocked(b.id)" class="status 已中止">
              {{ store.bayBlocked(b.id)?.code }} 处置中
            </span>
            <span v-else class="status 已完成">正常</span>
          </td>
        </tr>
      </tbody>
    </table>

    <h3>介质目录</h3>
    <table>
      <thead>
        <tr><th>编号</th><th>名称</th><th>危险类别</th></tr>
      </thead>
      <tbody>
        <tr v-for="m in store.media" :key="m.id">
          <td>{{ m.id }}</td>
          <td>{{ m.name }}</td>
          <td>{{ m.hazardClass }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
