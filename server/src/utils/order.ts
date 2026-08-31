// 订单价格计算工具
import { Dish } from '../types';

/**
 * 根据规格文本计算单价：dish.price + 每个 label 在 dish.specs 各组 options 中匹配到的 delta 之和
 * 规格文本格式示例：'大份/加辣'
 */
export function computeUnitPrice(dish: Dish, specText: string | null | undefined): number {
  let price = Number(dish.price) || 0;
  if (!specText) return price;

  const labels = String(specText).split('/');
  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;
    for (const group of dish.specs || []) {
      for (const option of group.options || []) {
        if (option.label === label) {
          price += Number(option.delta) || 0;
        }
      }
    }
  }
  return price;
}
