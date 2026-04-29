import type { PlanResponse } from '../api';
import { dateForDay, formatDate } from '../dates';
import { Button } from 'react-aria-components';

interface Props {
  plan: PlanResponse;
  currentDayIndex: number;
  onSelectDay: (idx: number) => void;
}

export default function WeekView({ plan, currentDayIndex, onSelectDay }: Props) {
  return (
    <div className="week-list">
      {plan.days.map((d, i) => (
        <Button
          key={d.day}
          onPress={() => onSelectDay(i)}
          className={`week-card ${i === currentDayIndex ? 'is-today' : ''}`}
        >
          <h3>Day {d.day} — {formatDate(dateForDay(plan.startDate, i))}</h3>
          <div className="week-meals">
            <div>🥣 {d.meals.breakfast.name}</div>
            <div>🥗 {d.meals.lunch.name}</div>
            <div>🍽️ {d.meals.dinner.name}</div>
          </div>
        </Button>
      ))}
    </div>
  );
}
