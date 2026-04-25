/**
 * 活动规模 · 切换处
 *
 * 想从 4 人测试版切回 15 人正式版，只需：
 *   1. 改下面两个常量 → PARTICIPANT_TOTAL = 15, REVEAL_THRESHOLD = 10
 *   2. 在 sql/02_e2e_schema.sql 里把 publish_seal RPC 的
 *      `expected_total constant int := 4` 改回 15，并在 Supabase
 *      SQL Editor 里重新执行那个 create or replace function 块
 *   3. 在 sql/01_schema.sql 里把示例邀请码恢复成 15 个真实的
 *
 * 约束：REVEAL_THRESHOLD 必须 ≥ 2，且 ≤ PARTICIPANT_TOTAL。
 * 推荐 threshold ≈ ⌈total × 2/3⌉，既有意义又留容错。
 */

export const PARTICIPANT_TOTAL = 4;
export const REVEAL_THRESHOLD = 3;

/** 心愿条数固定为 3，是产品语义不是参数。 */
export const WISHES_PER_PERSON = 3;
