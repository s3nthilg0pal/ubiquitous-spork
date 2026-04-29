import { useEffect, useState, useMemo } from 'react';
import { Button, Checkbox } from 'react-aria-components';
import { api, type ShoppingResponse } from '../api';

export default function ShoppingView() {
  const [data, setData] = useState<ShoppingResponse | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.getShopping()
      .then(d => {
        setData(d);
        setChecked(new Set(d.checked));
      })
      .catch(e => setError(String(e)));
  };

  useEffect(load, []);

  const itemId = (cat: string, item: string) => `${cat}::${item}`;

  const toggle = async (id: string) => {
    const willCheck = !checked.has(id);
    const next = new Set(checked);
    if (willCheck) next.add(id); else next.delete(id);
    setChecked(next);
    try {
      await api.toggleItem(id, willCheck);
    } catch (e) {
      // revert
      setChecked(checked);
      setError(String(e));
    }
  };

  const reset = async () => {
    if (!confirm('Clear all checked items?')) return;
    await api.resetShopping();
    setChecked(new Set());
  };

  const totals = useMemo(() => {
    if (!data) return { total: 0, done: 0 };
    let total = 0;
    let done = 0;
    for (const c of data.categories) {
      for (const item of c.items) {
        total++;
        if (checked.has(itemId(c.category, item))) done++;
      }
    }
    return { total, done };
  }, [data, checked]);

  if (error) return <div className="error">Failed to load: {error}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  return (
    <>
      <div className="shopping-controls">
        <Button onPress={reset} className="reset-btn">Reset list</Button>
        <span className="progress">{totals.done} / {totals.total} bought</span>
      </div>

      {data.categories.map(cat => {
        const catDone = cat.items.filter(i => checked.has(itemId(cat.category, i))).length;
        return (
          <div className="shop-category" key={cat.category}>
            <h3>
              <span>{cat.category}</span>
              <small>{catDone}/{cat.items.length}</small>
            </h3>
            {cat.items.map(item => {
              const id = itemId(cat.category, item);
              const isChecked = checked.has(id);
              return (
                <Checkbox
                  key={id}
                  isSelected={isChecked}
                  onChange={() => toggle(id)}
                  className={`shop-item ${isChecked ? 'checked' : ''}`}
                >
                  <div className="checkbox-box" aria-hidden>
                    {isChecked && <span className="checkmark">✓</span>}
                  </div>
                  <span className="shop-item-label">{item}</span>
                </Checkbox>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
