// 购物车状态：localStorage('xichu_cart') 持久化
import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CartItem, Dish } from '@/api/types'

const STORAGE_KEY = 'xichu_cart'

function loadSaved(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []
  } catch {
    return []
  }
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>(loadSaved())

  // 任何变化都持久化
  watch(items, (val) => localStorage.setItem(STORAGE_KEY, JSON.stringify(val)), { deep: true })

  // 总件数
  const totalQty = computed(() => items.value.reduce((s, i) => s + i.qty, 0))

  // 总价（2 位小数）
  const totalPrice = computed(() => Math.round(items.value.reduce((s, i) => s + i.unitPrice * i.qty, 0) * 100) / 100)

  // 查找同 dishId + spec 的条目
  function findItem(dishId: number, spec: string) {
    return items.value.find((i) => i.dishId === dishId && i.spec === spec)
  }

  // 加入购物车（同 dishId+spec 合并数量）
  function add(dish: Dish, specText: string, unitPrice: number, qty: number) {
    const existed = findItem(dish.id, specText)
    if (existed) {
      existed.qty += qty
    } else {
      items.value.push({
        dishId: dish.id,
        name: dish.name,
        image_url: dish.image_url,
        spec: specText,
        unitPrice,
        qty,
      })
    }
  }

  // 直接追加（再来一单：无需 Dish 完整对象）
  function addItem(item: CartItem) {
    const existed = findItem(item.dishId, item.spec)
    if (existed) {
      existed.qty += item.qty
    } else {
      items.value.push({ ...item })
    }
  }

  // 更新数量（qty<=0 移除）
  function updateQty(dishId: number, spec: string, qty: number) {
    const item = findItem(dishId, spec)
    if (!item) return
    if (qty <= 0) {
      items.value = items.value.filter((i) => i !== item)
    } else {
      item.qty = qty
    }
  }

  // 移除
  function remove(dishId: number, spec: string) {
    items.value = items.value.filter((i) => !(i.dishId === dishId && i.spec === spec))
  }

  // 清空
  function clear() {
    items.value = []
  }

  return { items, totalQty, totalPrice, add, addItem, updateQty, remove, clear }
})
