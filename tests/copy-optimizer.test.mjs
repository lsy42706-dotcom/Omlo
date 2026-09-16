import test from "node:test";
import assert from "node:assert/strict";
import { optimizeProjectCopy, polishResumeCell, projectHasOptimizableContent } from "../src/copyOptimizer.js";

test("完全空白的项目没有可优化内容", () => {
  assert.equal(projectHasOptimizableContent({ name: " ", role: "", description: "\n", achievements: ["", "  "] }), false);
});

test("每个单元格按自身内容保守优化且空白项保持空白", () => {
  const project = {
    id: "p1",
    name: "  智能家居网关  ",
    role: "  嵌入式工程师 ",
    description: "我主要负责  底层驱动开发，，参与了系统联调",
    achievements: ["完成了  通信模块开发", "", "实现了性能优化！！"],
  };
  assert.deepEqual(optimizeProjectCopy(project), {
    id: "p1",
    name: "智能家居网关",
    role: "嵌入式工程师",
    description: "负责底层驱动开发，参与系统联调。",
    achievements: ["完成通信模块开发", "", "实现性能优化！"],
  });
});

test("优化不会改写数字、英文缩写或原有事实", () => {
  assert.equal(polishResumeCell("主要负责 MQTT 模块，支持 100+ 设备"), "负责 MQTT 模块，支持 100+ 设备");
});
