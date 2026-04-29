export interface Meal {
  name: string;
  ingredients?: string[];
  method?: string[];
}

export interface DayMeals {
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snack: string;
}

export interface Day {
  day: number;
  meals: DayMeals;
}

export interface PlanResponse {
  days: Day[];
  startDate: string; // YYYY-MM-DD
}

export interface ShoppingCategory {
  category: string;
  items: string[];
}

export interface ShoppingResponse {
  categories: ShoppingCategory[];
  checked: string[];
}

const json = (r: Response) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export const api = {
  getPlan: (): Promise<PlanResponse> => fetch('/api/plan').then(json),
  getShopping: (): Promise<ShoppingResponse> => fetch('/api/shopping').then(json),
  toggleItem: (id: string, checked: boolean) =>
    fetch('/api/shopping/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, checked })
    }).then(json),
  resetShopping: () =>
    fetch('/api/shopping/reset', { method: 'POST' }).then(json)
};
