/**
 * 活动规模 · 切换处
 *
 * 当前：15 人正式版（threshold = 10）。
 * 切回 4 人测试版需要：
 *   1. 把下面两个常量改回 PARTICIPANT_TOTAL = 4, REVEAL_THRESHOLD = 3
 *   2. 新写一个 migration（参照 supabase/migrations/...004_scale_to_15.sql 的形式）
 *      把 publish_seal RPC 的 `expected_total constant int := 15` 改回 4，
 *      然后 supabase db push 应用上去
 *   3. invites 表里准备相应数量的邀请码
 *
 * 约束：REVEAL_THRESHOLD 必须 ≥ 2，且 ≤ PARTICIPANT_TOTAL。
 * 推荐 threshold ≈ ⌈total × 2/3⌉，既有意义又留容错。
 */

export const PARTICIPANT_TOTAL = 15;
export const REVEAL_THRESHOLD = 10;

/** 心愿条数固定为 3，是产品语义不是参数。 */
export const WISHES_PER_PERSON = 3;
